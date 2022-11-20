import type { APIGatewayEvent, Context } from 'aws-lambda'
import { minify } from 'html-minifier'
import * as iq from 'image-q'
import jimp from 'jimp'
import { z } from 'zod'

import { logger } from 'src/lib/logger'

type RLEImage = {
  rows: RLERun[][]
}

type RLERun = {
  r: number
  g: number
  b: number
  count: number
}

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

  const img = await process(body.image_url, 64, 32)
  const pixels = img.bitmap.data.length / 4

  const rleImg = await toRuns(img)
  let totalRuns = 0
  for (const row of rleImg.rows) totalRuns += row.length

  const html = toHTML(rleImg, 8)
  console.log({
    pixels,
    totalRuns,
    ratio: totalRuns / pixels,
    chars: html.length,
  })
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/html' },
    body: html,
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

async function toRuns(img: jimp): Promise<RLEImage> {
  const { data, width, height } = img.bitmap
  const rows: RLERun[][] = []
  for (let y = 0; y < height; y++) {
    const row: RLERun[] = []
    let run: RLERun | null = null
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (run && run.r === r && run.g === g && run.b === b) {
        run.count++
      } else {
        run = { r, g, b, count: 1 }
        row.push(run)
      }
    }
    rows.push(row)
  }
  return { rows }
}

function uint8ToHex(n: number): string {
  return n.toString(16).padStart(2, '0')
}

function colorToHex(color: { r: number; g: number; b: number }): string {
  return `#${uint8ToHex(color.r)}${uint8ToHex(color.g)}${uint8ToHex(color.b)}`
}

function toHTML(img: RLEImage, pxSize: number): string {
  function runToSpan(run: RLERun): string {
    return `<span style="display: inline-block; background: ${colorToHex(
      run
    )}; height: ${pxSize}px; width: ${pxSize * run.count}px"></span>`
  }
  function runsToDiv(runs: RLERun[]): string {
    return `<div style="height: ${pxSize}px">${runs
      .map(runToSpan)
      .join('')}</div>`
  }
  const bigHTML = img.rows.map(runsToDiv).join('')
  return minify(bigHTML, {
    collapseWhitespace: true,
    removeComments: true,
    removeAttributeQuotes: true,
    minifyCSS: true,
  })
}
