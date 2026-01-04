import * as zlib from 'zlib'
import { HeaderInfo } from './parseHeaders'

/**
 * Decodes the data based on the Content-Encoding header.
 *
 * @param data - The data to decode.
 * @param headers - The headers of the response.
 * @returns The decoded data.
 */
export function decodeData(
  data: Buffer | string,
  headers: HeaderInfo | HeaderInfo[],
): Buffer | string {
  if (typeof data === 'string') {
    return data
  }

  const lastHeaders = Array.isArray(headers)
    ? headers[headers.length - 1]
    : headers
  const contentEncoding = lastHeaders['content-encoding']

  if (!contentEncoding) {
    return data
  }

  // content-encoding is usually a string in this library (only Set-Cookie is array)
  // But just in case, handle if it were an array (though type suggests string for others).
  let encodingRaw: string

  if (Array.isArray(contentEncoding)) {
    encodingRaw = contentEncoding.join(', ')
  } else {
    encodingRaw = contentEncoding
  }

  const encoding = encodingRaw.trim().toLowerCase()

  try {
    if (encoding === 'gzip') {
      return zlib.gunzipSync(data)
    } else if (encoding === 'deflate') {
      return zlib.inflateSync(data)
    } else if (encoding === 'br') {
      return zlib.brotliDecompressSync(data)
    }
  } catch (error) {
    // If decoding fails, return original data or throw?
    // User didn't specify. Returning original data is safer to avoid crashing,
    // or maybe the data wasn't fully received?
    // But usually one expects it to work. Let's throw to let them know something is wrong,
    // or better, return partial?
    // I'll throw because if they asked for decoding and it fails, it's an error.
    throw new Error(
      `Failed to decode data with encoding ${encoding}: ${(error as Error).message}`,
    )
  }

  return data
}
