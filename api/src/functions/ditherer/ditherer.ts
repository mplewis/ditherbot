import type { APIGatewayEvent, Context } from 'aws-lambda'
import { minify } from 'html-minifier'
import * as iq from 'image-q'
import jimp from 'jimp'
import { z } from 'zod'

import { logger } from 'src/lib/logger'

const SECOND = 1000
const KB = 1024
const cohostMaxPostBytes = 200 * KB
const initialWidth = 64 // px
const searchTimeout = 5 * SECOND

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
  if (!contentType?.toLowerCase().startsWith('application/json')) {
    return restError(415, 'unsupported content type')
  }
  if (!event.body) return restError(400, 'missing request body')

  const schema = z.object({
    image_url: z.string(),
    colors: z.number().min(0).max(128).default(16),
    pixel_size: z.number().min(1).max(32).default(8),
    max_size: z
      .number()
      .min(1 * KB)
      .max(cohostMaxPostBytes)
      .default(cohostMaxPostBytes),
  })
  const rawBody = JSON.parse(event.body)
  const body = schema.parse(rawBody)
  console.log({ body })

  const original = await jimp.read(body.image_url)
  const out = await binarySearch({
    start: initialWidth,
    timeoutMs: searchTimeout,
    task: async (width) => {
      const img = await process(original.clone(), width, body.colors)
      const rleImg = await toRuns(img)
      const html = toHTML(rleImg, body.pixel_size)

      let result: BinarySearchCheckResult = 'Correct'
      if (html.length > body.max_size) result = 'TooHigh'
      else if (html.length < body.max_size) result = 'TooLow'

      return { result, output: { img, html } }
    },
  })
  if (!out) return restError(500, 'failed to dither image')
  const { img, html } = out

  const pixels = img.bitmap.width * img.bitmap.height
  console.log({
    pixels,
    chars: html.length,
    charsPerPixel: html.length / pixels,
  })
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/html' },
    body: html,
  }
}

function restError(status: number, msg: string) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: msg }),
  }
}

async function process(
  img: jimp,
  width: number,
  colors: number
): Promise<jimp> {
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
  const opc = imageQuantizer.quantizeSync(ipc, palette(ipc, colors))
  img.bitmap.data = Buffer.from(opc.toUint8Array())
  return img
}

function palette(ipc: iq.utils.PointContainer, colors: number) {
  if (colors === 0) return iq.buildPaletteSync([ipc])
  if (colors === 1) {
    const p = new iq.utils.Palette()
    p.add(iq.utils.Point.createByRGBA(0, 0, 0, 255))
    p.add(iq.utils.Point.createByRGBA(255, 255, 255, 255))
    return p
  }
  return iq.buildPaletteSync([ipc], { colors })
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

type BinarySearchCheckResult = 'TooLow' | 'TooHigh' | 'Correct'

async function binarySearch<T>(args: {
  timeoutMs: number | undefined
  start: number
  task: (n: number) => Promise<{ output: T; result: BinarySearchCheckResult }>
}): Promise<T | undefined> {
  const { start, task } = args
  const timeoutMs = args.timeoutMs || 1000
  const startTime = Date.now()
  let curr = Math.round(start)
  const seen: Set<number> = new Set()

  let best: T | undefined
  let stepSize: number | undefined
  while (Date.now() - startTime < timeoutMs) {
    if (stepSize && seen.has(curr)) break
    const { output, result } = await task(curr)
    if (stepSize) seen.add(curr)

    if (result === 'Correct') return output
    if (result === 'TooHigh') {
      if (!stepSize) {
        stepSize = Math.ceil(curr / 4)
      } else {
        stepSize = Math.ceil(stepSize / 2)
      }
      curr -= stepSize
    }
    if (result === 'TooLow') {
      best = output
      if (!stepSize) {
        curr *= 2
      } else {
        curr += stepSize
        stepSize = Math.ceil(stepSize / 2)
      }
    }
  }
  return best
}
