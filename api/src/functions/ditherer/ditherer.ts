import type { APIGatewayEvent, Context } from 'aws-lambda'
import fetch from 'cross-fetch'
import * as iq from 'image-q'
import jimp from 'jimp'
import { z } from 'zod'

import { logger } from 'src/lib/logger'

/**
 * The handler function is your code that processes http request events.
 * You can use return and throw to send a response or error, respectively.
 *
 * Important: When deployed, a custom serverless function is an open API endpoint and
 * is your responsibility to secure appropriately.
 *
 * @see {@link https://redwoodjs.com/docs/serverless-functions#security-considerations|Serverless Function Considerations}
 * in the RedwoodJS documentation for more information.
 *
 * @typedef { import('aws-lambda').APIGatewayEvent } APIGatewayEvent
 * @typedef { import('aws-lambda').Context } Context
 * @param { APIGatewayEvent } event - an object which contains information from the invoker.
 * @param { Context } context - contains information about the invocation,
 * function, and execution environment.
 */
export const handler = async (event: APIGatewayEvent, context: Context) => {
  logger.info('Invoked ditherer function')
  console.log({ event, context })
  const contentType = event.headers['content-type']
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return {
      statusCode: 415,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: `unsupported Content-Type: expected application/json, got ${contentType}`,
      }),
    }
  }

  const rawBody = JSON.parse(event.body)
  const body = z.object({ image_url: z.string() }).parse(rawBody)

  const img = await process(body.image_url, 48, 32)
  console.log({ bytes: img.bitmap.data.length })

  const buf = await img.getBufferAsync(jimp.MIME_PNG)
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/png' },
    body: buf,
  }
}

async function process(
  src: string,
  width: number,
  colors: number
): Promise<jimp> {
  const img = await jimp.read(src)
  const w = img.getWidth()
  const h = img.getHeight()
  const newWidth = width
  const newHeight = Math.round((newWidth / w) * h)
  img.resize(newWidth, newHeight)
  const ipc = iq.utils.PointContainer.fromUint8Array(
    img.bitmap.data,
    newWidth,
    newHeight
  )
  const imageQuantizer = new iq.image.ErrorDiffusionArray(
    new iq.distance.EuclideanBT709(),
    iq.image.ErrorDiffusionArrayKernel.Stucki
  )
  const palette = iq.buildPaletteSync([ipc], { colors })
  const opc = imageQuantizer.quantizeSync(ipc, palette)
  img.bitmap.data = Buffer.from(opc.toUint8Array())
  return img
}
