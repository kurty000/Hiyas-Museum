/*
 * Hiyas Museum — ESP32 sensor node
 *
 * Writes to Firebase RTDB: /liveSensors/{DEVICE_ID}
 * Website rule: DEVICE_ID must match the registered Firestore sensor document id.
 *
 * IMPORTANT: send a changing "heartbeat" on every PUT so the dashboard
 * can refresh last-seen even when temperature/humidity stay the same.
 * Without heartbeat, stable readings look "dead" / Offline after the timeout
 * because identical RTDB payloads do not notify website listeners.
 *
 * Serial Monitor: set baud to 115200.
 * Firebase HTTP codes printed as "Firebase: <code>":
 *   200       = OK — write accepted
 *   401 / 403 = Permission denied — check database.rules.json / path / JSON shape
 *   -1        = Connection failed — WiFi, TLS, DNS, or host URL
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>

const char* WIFI_SSID     = "Free_Wifi";
const char* WIFI_PASSWORD = "P@ssw0rd2026";

// Must match the registered sensor id on the website exactly
const char* DEVICE_ID   = "esp32_gallery_a_1";
const char* DEVICE_NAME = "Gallery A - Artifact 1";
const char* LOCATION    = "Gallery A";

const char* FIREBASE_HOST =
  "https://hiyas-museum-da909-default-rtdb.asia-southeast1.firebasedatabase.app";

#define PIR_PIN  13
#define DHT_PIN  15
#define DHT_TYPE DHT11
#define ECHO_PIN 5
#define TRIG_PIN 4

DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 5000;
unsigned long heartbeat = 0;

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
  // Changing every send — keeps the website Online while this ESP is alive
  json += "\"heartbeat\":" + String(heartbeat) + ",";
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
  String body = http.getString();
  http.end();

  Serial.print("Firebase: ");
  Serial.println(code);
  // 200 OK | 401/403 rules denied | -1 connection/TLS/DNS failure
  if (code < 200 || code >= 300) {
    Serial.print("Firebase body: ");
    Serial.println(body);
  }
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
  Serial.print("IP: ");
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
  connectWiFi();
  Serial.println("Hiyas Museum ESP ready");
  Serial.print("DEVICE_ID=");
  Serial.println(DEVICE_ID);
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

  if (!isnan(temperature) && !isnan(humidity) && millis() - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = millis();

    String status = "safe";
    if (motion || (distance > 0 && distance < 50)) status = "critical";
    else if (temperature > 24 || humidity > 60) status = "warning";

    float dist = distance < 0 ? 999 : distance;
    putFirebase(buildJson(temperature, humidity, motion, dist, status));
  } else if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT read failed — skip PUT (need temperature+humidity for RTDB rules)");
  }

  Serial.println("==============================");
  delay(2000);
}
