import QRCode from 'qrcode'

const qrInput = document.getElementById('qr-input')
const canvas = document.getElementById('canvas')

const isASCII = str => /^[\x00-\x7F]*$/.test(str)

const generateQR = async text => {
  if (!text.trim()) {
    console.log('Input text is empty.')
    return
  }

  let chunks
  if (isASCII(text)) {
    // If the text contains only ASCII characters, split it into chunks of 1000 characters each
    chunks = text.match(/.{1,1000}/g)
  } else {
    // If the text contains non-ASCII characters, convert it to a Buffer and split it into chunks of 1000 bytes each
    const buffer = Buffer.from(text, 'utf8')
    chunks = []
    let i = 0
    while (i < buffer.length) {
      let end = i + 1000
      if (end > buffer.length) {
        end = buffer.length
      }
      chunks.push(buffer.slice(i, end).toString('utf8'))
      i = end
    }
  }

//   // Split the text into chunks of 1000 characters each
//   const chunks = text.match(/.{1,1000}/g)

  for (const chunk of chunks) {
    try {
      const startTime = performance.now();
      await QRCode.toCanvas(canvas, chunk);
      const endTime = performance.now();
      const timeElapsed = endTime - startTime;
      console.log(`Time consumed: ${timeElapsed.toFixed(2)} ms`);
      // console.log(await QRCode.toDataURL(chunk))
    } catch (err) {
      console.error(err)
    }
    // Wait for 2 seconds before generating the next QR code
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

qrInput.addEventListener('input', (e) => {
  generateQR(e.target.value)
})
