# qr-code-generator
QR Code Generator

# How to run
`npm start`

# Features
- It can deal with unlimited length of English and Chinese characters
- Data exceeding the QR max storage limit will be segregated into several QR code to display

# TODO
- If too much data, append and index at the start of the QR Code such that `1/8|(Data)` format is used to represent data orders. The 1st page will be `1/8|(Data)`, the 2nd QR code will be `2/8|(Data)`.
- Write a decoding client.
- Use NextUI to add a drag-n-drop button.