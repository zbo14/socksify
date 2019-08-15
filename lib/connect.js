'use strict'

const net = require('net')
const tls = require('tls')

/** @module connect */

/**
 * Adds SOCKS4(a) proxying support to net.connect() and tls.connect().
 * Resolves a net.Socket or tls.TLSSocket.
 *
 * @param  {Object}  opts
 * @param  {String}  opts.host        - the destination hostname
 * @param  {Number}  opts.port        - the destination port
 * @param  {String}  [opts.proxyHost] - the proxy hostname
 * @param  {Number}  [opts.proxyPort] - the proxy port
 * @param  {Boolean} [opts.secure]    - whether to establish TLS connection from proxy to destination
 *
 * @return {Promise}
 */
const connect = opts => {
  const useProxy = opts.proxyPort && opts.proxyHost
  const port = useProxy ? opts.proxyPort : opts.port
  const host = useProxy ? opts.proxyHost : opts.host
  const timeout = opts.timeout || 5e3

  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeout)

    const secure = opts.secure || (opts.secure !== false && opts.port === 443)

    let sock = net.connect(port, host, () => {
      if (!useProxy) {
        if (secure) {
          sock = new tls.TLSSocket(sock)
        }

        return resolve(sock)
      }

      const port = Buffer.alloc(2)
      port.writeUInt16BE(opts.port)

      const arr = [4, 1, ...port]
      const octets = opts.host.split('.').map(Number)
      const isIP = octets.length === 4 && octets.every(x => x >= 0 && x < 256)

      if (isIP) {
        arr.push(...octets, 0)
      } else {
        const host = [...opts.host].map(c => c.charCodeAt(0))
        arr.push(0, 0, 0, 1, 0, ...host, 0)
      }

      let buf = Buffer.alloc(0)

      const ondata = chunk => {
        buf = Buffer.concat([buf, chunk])

        if (buf.byteLength && buf[0]) {
          return reject(new Error('Expected null byte'))
        }

        if (buf.byteLength > 1) {
          sock.removeListener('data', ondata)

          if (buf[1] !== 0x5a) {
            return reject(new Error('Request failed'))
          }
        }

        if (secure) {
          sock = new tls.TLSSocket(sock)
        }

        resolve(sock)
      }

      sock
        .on('data', ondata)
        .write(Buffer.from(arr))
    }).once('error', reject)
  })
}

module.exports = connect
