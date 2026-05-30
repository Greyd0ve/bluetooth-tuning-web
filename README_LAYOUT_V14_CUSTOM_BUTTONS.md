# V14 Custom Button Packets

This version adds custom packet sending to the Tools -> Buttons panel.

- Each button now has a custom packet textarea.
- If the custom packet is not empty, pressing the button sends that text directly.
- The global packet newline option is still respected.
- If the custom packet is empty, the original `[key,name,down/up]` behavior remains unchanged.
- Existing transport logic for BLE, Web Serial, and Orange Pi Bridge is unchanged.
