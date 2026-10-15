/*
 * Hiyas Museum — ESP32 + SIM800L sensor node
 *
 * Sensors (match schematic):
 *   PIR  → IO13
 *   DHT11 → IO15
 *   HC-SR04 TRIG → IO4, ECHO → IO5
 *
 * SIM800L UART (match schematic):
 *   ESP32 IO16 (TX_SIM) → SIM800L RX  (via 10k/20k divider on schematic)
 *   ESP32 IO17 (RX_SIM) ← SIM800L TX
 *   SIM800L VCC on separate 5V_GSM supply (high current bursts)
 *
 * Firebase RTDB: /liveSensors/{DEVICE_ID}
 * SMS: one text per critical event (motion / too-close distance).
 *      Clears when status returns to safe/warning so a later breach can text again.
 *
 * Serial Monitor baud: 115200
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>

// ── WiFi / Firebase ──────────────────────────────────────────────
const char* WIFI_SSID     = "Free_Wifi";
const char* WIFI_PASSWORD = "P@ssw0rd2026";

const char* DEVICE_ID   = "esp32_gallery_a_1";
const char* DEVICE_NAME = "Gallery A - Artifact 1";
const char* LOCATION    = "Gallery A";

const char* FIREBASE_HOST =
  "https://hiyas-museum-da909-default-rtdb.asia-southeast1.firebasedatabase.app";

// ── SMS (Philippines numbers → E.164) ────────────────────────────
// SIM in module: 09602506714  |  Receiver: 09602990107
const char* SMS_TO = "+639602990107";

// ── Pins (schematic) ─────────────────────────────────────────────
#define PIR_PIN   13
#define DHT_PIN   15
#define DHT_TYPE  DHT11
#define TRIG_PIN  4
#define ECHO_PIN  5

#define SIM_RX_PIN 17  // ESP receives from SIM800L TX
#define SIM_TX_PIN 16  // ESP transmits to SIM800L RX

DHT dht(DHT_PIN, DHT_TYPE);
HardwareSerial SimSerial(2);

unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 5000;
unsigned long heartbeat = 0;

/** One SMS per critical stretch — same idea as website one-notification-per-event */
bool smsSentForCritical = false;

// ── SIM800L helpers ──────────────────────────────────────────────
String simReadResponse(unsigned long timeoutMs = 3000) {
  String resp;
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (SimSerial.available()) {
      char c = (char)SimSerial.read();
      resp += c;
      start = millis(); // extend while data keeps arriving
    }
    delay(10);
  }
  return resp;
}

bool simSendCommand(const String& cmd, const char* expect = "OK", unsigned long timeoutMs = 3000) {
  Serial.print("[SIM] >> ");
  Serial.println(cmd);
  SimSerial.println(cmd);
  String resp = simReadResponse(timeoutMs);
  Serial.print("[SIM] << ");
  Serial.println(resp);
  return expect == nullptr || resp.indexOf(expect) >= 0;
}

bool simWaitFor(const char* token, unsigned long timeoutMs = 10000) {
  String resp;
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (SimSerial.available()) {
      char c = (char)SimSerial.read();
      resp += c;
      if (resp.indexOf(token) >= 0) {
        Serial.print("[SIM] << ");
        Serial.println(resp);
        return true;
      }
    }
    delay(10);
  }
  Serial.print("[SIM] timeout waiting for ");
  Serial.println(token);
  Serial.print("[SIM] << ");
  Serial.println(resp);
  return false;
}

bool initSim800L() {
  SimSerial.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  delay(2000);

  // Wake / basic AT
  for (int i = 0; i < 5; i++) {
    if (simSendCommand("AT", "OK", 2000)) break;
    delay(500);
  }
  if (!simSendCommand("AT", "OK", 2000)) {
    Serial.println("[SIM] Module not responding — check 5V_GSM power, GND, TX/RX");
    return false;
  }

  simSendCommand("ATE0", "OK");           // echo off
  simSendCommand("AT+CMGF=1", "OK");      // text mode
  simSendCommand("AT+CSCS=\"GSM\"", "OK");
  simSendCommand("AT+CNMI=0,0,0,0,0", "OK"); // don't interrupt with inbound SMS

  // Network registration (0,1 home or 0,5 roaming)
  bool registered = false;
  for (int i = 0; i < 15; i++) {
    SimSerial.println("AT+CREG?");
    String resp = simReadResponse(2000);
    Serial.print("[SIM] CREG ");
    Serial.println(resp);
    if (resp.indexOf(",1") >= 0 || resp.indexOf(",5") >= 0) {
      registered = true;
      break;
    }
    delay(2000);
  }
  if (!registered) {
    Serial.println("[SIM] Not registered on network yet — SMS may fail until signal is OK");
  }

  simSendCommand("AT+CSQ", "OK"); // signal quality
  return true;
}

bool sendSms(const String& to, const String& message) {
  Serial.println("[SIM] Sending SMS...");
  Serial.print("[SIM] To: ");
  Serial.println(to);
  Serial.print("[SIM] Msg: ");
  Serial.println(message);

  // Ensure text mode
  if (!simSendCommand("AT+CMGF=1", "OK", 2000)) return false;

  SimSerial.print("AT+CMGS=\"");
  SimSerial.print(to);
  SimSerial.println("\"");

  if (!simWaitFor(">", 8000)) {
    Serial.println("[SIM] No '>' prompt — abort SMS");
    SimSerial.write(0x1B); // ESC cancel
    return false;
  }

  SimSerial.print(message);
  SimSerial.write(0x1A); // Ctrl+Z send

  // Success typically includes +CMGS: and OK
  String resp = simReadResponse(15000);
  Serial.print("[SIM] << ");
  Serial.println(resp);
  bool ok = resp.indexOf("+CMGS:") >= 0 || resp.indexOf("OK") >= 0;
  Serial.println(ok ? "[SIM] SMS OK" : "[SIM] SMS FAILED");
  return ok;
}

void maybeSendCriticalSms(const String& status, bool motion, float distanceCm) {
  bool critical = (status == "critical");

  if (!critical) {
    // Event cleared — allow a new SMS on the next breach
    smsSentForCritical = false;
    return;
  }

  if (smsSentForCritical) return;

  String msg = "HIYAS ALERT: ";
  msg += DEVICE_NAME;
  msg += " (";
  msg += LOCATION;
  msg += ") CRITICAL. ";
  if (motion) msg += "Motion/proximity breach. ";
  if (distanceCm > 0 && distanceCm < 50) {
    msg += "Object at ";
    msg += String(distanceCm, 1);
    msg += " cm. ";
  }
  msg += "Check museum now.";

  if (sendSms(SMS_TO, msg)) {
    smsSentForCritical = true;
  }
}

// ── Firebase ─────────────────────────────────────────────────────
String buildJson(float t, float h, bool motion, float distance, String status) {
  heartbeat++;

  String json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"name\":\"" + String(DEVICE_NAME) + "\",";
  json += "\"location\":\"" + String(LOCATION) + "\",";
  json += "\"temperature\":" + String(t, 1) + ",";
  json += "\"humidity\":" + String(h, 1) + ",";
  json += "\"motionDetected\":" + String(motion ? "true" : "false") + ",";
  json += "\"distanceCm\":" + String(distance, 1) + ",";
  json += "\"status\":\"" + status + "\",";
  json += "\"heartbeat\":" + String(heartbeat) + ",";
  json += "\"smsArmed\":" + String(smsSentForCritical ? "false" : "true") + ",";
  json += "\"source\":\"esp32\"";
  json += "}";
  return json;
}

bool putFirebase(String json) {
  String url = String(FIREBASE_HOST) + "/liveSensors/" + DEVICE_ID + ".json";

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(json);
  http.end();

  Serial.print("Firebase: ");
  Serial.println(code);
  return code >= 200 && code < 300;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(WiFi.localIP());
}

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1;
  return duration * 0.0343 / 2.0;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  dht.begin();

  Serial.println("Hiyas Museum ESP + SIM800L");
  Serial.print("DEVICE_ID=");
  Serial.println(DEVICE_ID);
  Serial.print("SMS_TO=");
  Serial.println(SMS_TO);

  initSim800L();
  connectWiFi();
  delay(2000);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  bool motion = digitalRead(PIR_PIN) == HIGH;
  float distance = readDistanceCm();

  Serial.println("==============================");
  Serial.print("Temp: "); Serial.println(temperature);
  Serial.print("Humidity: "); Serial.println(humidity);
  Serial.print("PIR: "); Serial.println(motion ? "MOTION" : "NO MOTION");
  Serial.print("Distance: "); Serial.println(distance);

  String status = "safe";
  if (motion || (distance > 0 && distance < 50)) status = "critical";
  else if (!isnan(temperature) && !isnan(humidity) &&
           (temperature > 24 || humidity > 60)) status = "warning";

  // SMS independent of DHT — security breach can still text
  maybeSendCriticalSms(status, motion, distance);

  if (!isnan(temperature) && !isnan(humidity) && millis() - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = millis();
    float dist = distance < 0 ? 999 : distance;
    putFirebase(buildJson(temperature, humidity, motion, dist, status));
  } else if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT nan — skip Firebase PUT (SMS still active for critical)");
  }

  Serial.print("Status: "); Serial.println(status);
  Serial.print("SMS latch: "); Serial.println(smsSentForCritical ? "sent-this-event" : "armed");
  Serial.println("==============================");
  delay(2000);
}
