# Hiyas Museum ESP32 + SIM800L

## Wiring (from schematic)

| Device | ESP32 pin |
|--------|-----------|
| PIR signal | IO13 |
| DHT11 data | IO15 |
| HC-SR04 TRIG | IO4 |
| HC-SR04 ECHO | IO5 (via divider) |
| SIM800L RX | from ESP **IO16** (TX_SIM, via divider) |
| SIM800L TX | to ESP **IO17** (RX_SIM) |
| SIM800L VCC | **5V_GSM** (separate battery/regulator + big capacitor) |
| All GND | common |

## SMS behavior

- Receiver: `+639602990107` (09602990107)
- Sends **one SMS per critical event** (PIR motion or distance &lt; 50 cm)
- When the breach clears (status leaves `critical`), the latch resets so a later breach can SMS again
- SMS still works if DHT is `nan` (Firebase PUT still needs valid DHT for RTDB rules)

## Flash

1. Open `hiyas_museum_sensor.ino` in Arduino IDE
2. Board: ESP32 Dev Module
3. Serial Monitor: **115200**
4. Look for `[SIM] >> AT` / `OK`, then `CREG` with `,1` or `,5`
5. Trigger PIR or put an object close (&lt; 50 cm) → expect `[SIM] SMS OK`

## Troubleshooting SIM800L

- No AT response → 5V_GSM power too weak, or TX/RX swapped
- CREG never `,1`/`,5` → antenna / SIM / signal
- `>` prompt never appears → baud or wiring
- Firebase `200` but no SMS → network registration / credit / number format
