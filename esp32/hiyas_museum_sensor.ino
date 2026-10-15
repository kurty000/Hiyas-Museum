/*
 * Hiyas Museum — ESP32 + SIM800L sensor node
 *
 * Flow:
 *   1) ESP writes sensor data → RTDB /liveSensors/{DEVICE_ID}
 *   2) Website creates an alert in Firestore
 *   3) Website queues RTDB /smsCommands/{DEVICE_ID}
 *   4) ESP polls that command and ONLY THEN sends SMS via SIM800L
 *   5) ESP marks sent=true (website toast confirms), then clears on next poll
 *
 * Pins (schematic):
 *   PIR IO13 | DHT11 IO15 | TRIG IO4 | ECHO IO5
 *   SIM800L: ESP IO16 TX → SIM RX | ESP IO17 RX ← SIM TX
 *
 * Serial Monitor: 115200
 *
 * IMPORTANT: always PUT a changing "heartbeat" so the dashboard stays Online.
 * DHT nan must NOT skip the Firebase upload (motion/distance/heartbeat still matter).
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>

const char* WIFI_SSID     = "Free_Wifi";
const char* WIFI_PASSWORD = "P@ssw0rd2026";

// Must match the registered Firestore sensor document id exactly
const char* DEVICE_ID   = "esp32_gallery_a_1";
const char* DEVICE_NAME = "Gallery A - Artifact 1";
const char* LOCATION    = "Gallery A";

const char* FIREBASE_HOST =
  "https://hiyas-museum-da909-default-rtdb.asia-southeast1.firebasedatabase.app";

// Fallback if queue omits "to" (website normally sets this)
const char* SMS_TO_DEFAULT = "+639602990107";

#define PIR_PIN   13
#define DHT_PIN   15
#define DHT_TYPE  DHT11
#define TRIG_PIN  4
#define ECHO_PIN  5
#define SIM_RX_PIN 17
#define SIM_TX_PIN 16

DHT dht(DHT_PIN, DHT_TYPE);
HardwareSerial SimSerial(2);

unsigned long lastSendMs = 0;
unsigned long lastSmsPollMs = 0;
const unsigned long SEND_INTERVAL_MS = 5000;
const unsigned long SMS_POLL_INTERVAL_MS = 3000;
unsigned long heartbeat = 0;
String lastHandledAlertId = "";

// Last good DHT readings — keep uploading heartbeat/motion/distance if DHT flakes
float lastGoodTemp = 22.0;
float lastGoodHumidity = 50.0;

// ── SIM800L ──────────────────────────────────────────────────────
/** Read until expect token appears, or timeout. Returns early on match (does not wait full silence). */
String simReadUntil(const char* expect, unsigned long timeoutMs) {
  String resp;
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (SimSerial.available()) {
      char c = (char)SimSerial.read();
      resp += c;
      if (expect != nullptr && resp.indexOf(expect) >= 0) {
        delay(30);
        while (SimSerial.available()) {
          resp += (char)SimSerial.read();
        }
        return resp;
      }
    }
    delay(10);
  }
  return resp;
}

bool simSendCommand(const String& cmd, const char* expect = "OK", unsigned long timeoutMs = 3000) {
  Serial.print("[SIM] >> ");
  Serial.println(cmd);
  SimSerial.println(cmd);
  String resp = simReadUntil(expect, timeoutMs);
  Serial.print("[SIM] << ");
  Serial.println(resp);
  return expect == nullptr || resp.indexOf(expect) >= 0;
}

bool simWaitFor(const char* token, unsigned long timeoutMs = 10000) {
  String resp = simReadUntil(token, timeoutMs);
  if (resp.indexOf(token) >= 0) {
    Serial.print("[SIM] << ");
    Serial.println(resp);
    return true;
  }
  Serial.print("[SIM] timeout waiting for ");
  Serial.println(token);
  return false;
}

bool initSim800L() {
  SimSerial.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  delay(2000);

  for (int i = 0; i < 5; i++) {
    if (simSendCommand("AT", "OK", 2000)) break;
    delay(500);
  }
  if (!simSendCommand("AT", "OK", 2000)) {
    Serial.println("[SIM] No response — check 5V_GSM / TX-RX");
    return false;
  }

  simSendCommand("ATE0", "OK");
  simSendCommand("AT+CMGF=1", "OK");
  simSendCommand("AT+CSCS=\"GSM\"", "OK");
  simSendCommand("AT+CNMI=0,0,0,0,0", "OK");
  simSendCommand("AT+CSQ", "OK");
  return true;
}

bool sendSms(const String& to, const String& message) {
  Serial.println("[SIM] Sending SMS (website-triggered)...");
  Serial.print("[SIM] To: "); Serial.println(to);
  Serial.print("[SIM] Msg: "); Serial.println(message);

  if (!simSendCommand("AT+CMGF=1", "OK", 2000)) return false;

  SimSerial.print("AT+CMGS=\"");
  SimSerial.print(to);
  SimSerial.println("\"");

  if (!simWaitFor(">", 8000)) {
    SimSerial.write(0x1B); // ESC cancel
    return false;
  }

  SimSerial.print(message);
  SimSerial.write(0x1A); // Ctrl+Z

  // Prefer +CMGS: (true success); also accept OK. Exit early — do not burn 15s of silence.
  String resp = simReadUntil("+CMGS:", 20000);
  if (resp.indexOf("+CMGS:") < 0 && resp.indexOf("OK") < 0) {
    String more = simReadUntil("OK", 5000);
    resp += more;
  }
  Serial.print("[SIM] << ");
  Serial.println(resp);
  bool ok = resp.indexOf("+CMGS:") >= 0 || resp.indexOf("OK") >= 0;
  Serial.println(ok ? "[SIM] SMS OK" : "[SIM] SMS FAILED");
  return ok;
}

// ── Firebase HTTP ────────────────────────────────────────────────
bool putFirebaseLive(const String& json) {
  String url = String(FIREBASE_HOST) + "/liveSensors/" + DEVICE_ID + ".json";
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(json);
  http.end();
  Serial.print("Firebase live: ");
  Serial.println(code);
  return code >= 200 && code < 300;
}

bool markSmsCommandSent(const String& alertId) {
  // Rules require alertId + message + sent; unauthenticated write allowed when sent=true
  // Keep sent:true briefly so the website watch can toast confirmation
  String url = String(FIREBASE_HOST) + "/smsCommands/" + DEVICE_ID + ".json";
  String json = "{";
  json += "\"alertId\":\"" + alertId + "\",";
  json += "\"message\":\"\",";
  json += "\"sent\":true";
  json += "}";

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(json);
  http.end();
  Serial.print("Firebase SMS ack: ");
  Serial.println(code);
  return code >= 200 && code < 300;
}

bool deleteSmsCommand() {
  String url = String(FIREBASE_HOST) + "/smsCommands/" + DEVICE_ID + ".json";
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  int code = http.sendRequest("DELETE");
  http.end();
  Serial.print("Firebase SMS clear: ");
  Serial.println(code);
  return code >= 200 && code < 300;
}

/** Extract JSON string value for a key (simple parser — no ArduinoJson required) */
String jsonGetString(const String& body, const char* key) {
  String pattern = String("\"") + key + "\":\"";
  int start = body.indexOf(pattern);
  if (start < 0) return "";
  start += pattern.length();
  int end = body.indexOf("\"", start);
  if (end < 0) return "";
  return body.substring(start, end);
}

bool jsonGetBool(const String& body, const char* key, bool defaultVal = false) {
  String pattern = String("\"") + key + "\":";
  int start = body.indexOf(pattern);
  if (start < 0) return defaultVal;
  start += pattern.length();
  while (start < (int)body.length() && body[start] == ' ') start++;
  if (body.startsWith("true", start)) return true;
  if (body.startsWith("false", start)) return false;
  return defaultVal;
}

/** Poll RTDB for a website-queued SMS command */
void pollSmsCommandFromWebsite() {
  String url = String(FIREBASE_HOST) + "/smsCommands/" + DEVICE_ID + ".json";
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  int code = http.GET();
  String body = http.getString();
  http.end();

  if (code != 200) {
    Serial.print("[SMS] poll HTTP ");
    Serial.println(code);
    return;
  }

  if (body == "null" || body.length() < 5) {
    return; // no pending command
  }

  Serial.print("[SMS] poll body: ");
  Serial.println(body);

  if (jsonGetBool(body, "sent", false)) {
    // Leave sent:true briefly so the website can confirm, then clear the slot
    Serial.println("[SMS] command already marked sent — clearing");
    deleteSmsCommand();
    return;
  }

  String alertId = jsonGetString(body, "alertId");
  String message = jsonGetString(body, "message");
  String to = jsonGetString(body, "to");
  if (to.length() == 0) to = SMS_TO_DEFAULT;

  if (message.length() == 0) {
    Serial.println("[SMS] Empty message — ignore / clear junk");
    markSmsCommandSent(alertId.length() ? alertId : "empty");
    return;
  }

  if (alertId.length() > 0 && lastHandledAlertId == alertId) {
    Serial.println("[SMS] Already handled this alertId");
    markSmsCommandSent(alertId);
    return;
  }

  Serial.println("[SMS] Website alert command received — sending via SIM800L");
  if (sendSms(to, message)) {
    lastHandledAlertId = alertId;
    // Keep sent:true in RTDB so the dashboard toast can confirm delivery
    markSmsCommandSent(alertId.length() ? alertId : "ok");
  } else {
    Serial.println("[SMS] SIM800L failed — leaving command for retry");
  }
}

String buildLiveJson(float t, float h, bool motion, float distance, String status) {
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
  json += "\"source\":\"esp32\"";
  json += "}";
  return json;
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
  Serial.println("SMS only after website creates an alert");
  Serial.print("DEVICE_ID=");
  Serial.println(DEVICE_ID);

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

  // Keep last good DHT so nan never blocks heartbeat / motion / distance uploads
  bool dhtOk = !isnan(temperature) && !isnan(humidity);
  if (dhtOk) {
    lastGoodTemp = temperature;
    lastGoodHumidity = humidity;
  } else {
    Serial.println("DHT nan — using last good values for Firebase PUT");
    temperature = lastGoodTemp;
    humidity = lastGoodHumidity;
  }

  Serial.println("==============================");
  Serial.print("Temp: "); Serial.println(temperature);
  Serial.print("Humidity: "); Serial.println(humidity);
  Serial.print("PIR: "); Serial.println(motion ? "MOTION" : "NO MOTION");
  Serial.print("Distance: "); Serial.println(distance);
  if (!dhtOk) Serial.println("(DHT reading was nan this cycle)");

  String status = "safe";
  if (motion || (distance > 0 && distance < 50)) status = "critical";
  else if (temperature > 24 || humidity > 60) status = "warning";

  // 1) Upload live readings every SEND_INTERVAL (always — keeps Online + motion fresh)
  if (millis() - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = millis();
    float dist = distance < 0 ? 999 : distance;
    putFirebaseLive(buildLiveJson(temperature, humidity, motion, dist, status));
  }

  // 2) Poll website SMS queue (only send if alert was created on the site)
  if (millis() - lastSmsPollMs >= SMS_POLL_INTERVAL_MS) {
    lastSmsPollMs = millis();
    pollSmsCommandFromWebsite();
  }

  Serial.print("Status: "); Serial.println(status);
  Serial.println("==============================");
  delay(500);
}
