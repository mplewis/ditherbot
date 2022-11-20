import type { APIGatewayEvent, Context } from 'aws-lambda'
import fetch from 'cross-fetch'
import * as iq from 'image-q'
import { PNG } from 'pngjs'
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
  const resp = await fetch(body.image_url)
  console.log({ resp })

  const blob = await resp.blob()
  const buffer = await blob.arrayBuffer()
  console.log(`read bytes: ${buffer.byteLength}`)

  const { data, width, height } = PNG.sync.read(Buffer.from(buffer))
  const ipc = iq.utils.PointContainer.fromUint8Array(data, width, height)

  // TODO: processing...
  // const pal = iq.buildPaletteSync([ipc])
  // const opc = iq.applyPaletteSync(ipc, pal)
  const obuf = ipc.toUint8Array()

  const opngObj = new PNG()
  opngObj.data = Buffer.from(obuf)
  opngObj.width = width
  opngObj.height = height
  const opng = PNG.sync.write(opngObj)

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/png' },
    body: opng,
  }
}
