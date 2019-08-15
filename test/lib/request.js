'use strict'

const assert = require('assert')
const { once } = require('events')
const fs = require('fs')
const http = require('http')
const https = require('https')
const net = require('net')
const path = require('path')
const request = require('../../lib/request')

const fixturesPath = path.join(__dirname, '..', 'fixtures')
const cert = fs.readFileSync(path.join(fixturesPath, 'server.crt'))
const key = fs.readFileSync(path.join(fixturesPath, 'server.key'))

const host = '127.0.0.1'
const port = 1234
const proxyPort = 8081
const proxyHost = '127.0.0.1'

const testSuite = secure => {
  const { createServer } = secure ? https : http
  const opts = secure ? { cert, key } : {}
  const proto = secure ? 'https' : 'http'

  describe(proto, () => {
    beforeEach(async () => {
      this.proxy = net.createServer()
      this.server = createServer(opts)

      await Promise.all([
        new Promise(resolve => this.proxy.listen(proxyPort, proxyHost, resolve)),
        new Promise(resolve => this.server.listen(port, host, resolve))
      ])
    })

    afterEach(() => {
      this.proxy.close()
      this.server.close()
    })

    it('proxies a GET request', async () => {
      this.server.once('request', (_, resp) => {
        resp.setHeader('x-foo', 'bar')
        resp.end('foobar')
      })

      const promise = request(proto + '://127.0.0.1:' + port, { proxyHost, proxyPort })
      const [sock1] = await once(this.proxy, 'connection')

      const buf = Buffer.alloc(2)
      buf.writeUInt16BE(port)

      let data = Buffer.alloc(0)

      while (data.byteLength < 9) {
        const [chunk] = await once(sock1, 'data')
        data = Buffer.concat([data, chunk])
      }

      assert.deepStrictEqual(data, Buffer.from([4, 1, ...buf, 127, 0, 0, 1, 0]))

      const sock2 = net.connect(port, host, () => {
        sock1.write(Buffer.from([0, 0x5a, 0, 0, 0, 0, 0, 0]))
        sock1.pipe(sock2).pipe(sock1)
      })

      const { code, headers, body } = await promise

      assert.strictEqual(code, 200)
      assert.strictEqual(headers['x-foo'], 'bar')
      assert.strictEqual(body, 'foobar')
    })

    it('proxies a POST request with body', async () => {
      this.server.once('request', (req, resp) => {
        let body = ''

        req.on('data', chunk => {
          body += chunk
        })

        req.once('end', () => {
          if (body !== 'foobar') {
            resp.writeHead(400)
            return resp.end()
          }

          resp.end('foobaz')
        })
      })

      const promise = request(proto + '://127.0.0.1:' + port, {
        body: 'foobar',
        method: 'POST',
        proxyHost,
        proxyPort
      })

      const [sock1] = await once(this.proxy, 'connection')

      const buf = Buffer.alloc(2)
      buf.writeUInt16BE(port)

      let data = Buffer.alloc(0)

      while (data.byteLength < 9) {
        const [chunk] = await once(sock1, 'data')
        data = Buffer.concat([data, chunk])
      }

      assert.deepStrictEqual(data, Buffer.from([4, 1, ...buf, 127, 0, 0, 1, 0]))

      const sock2 = net.connect(port, host, () => {
        sock1.write(Buffer.from([0, 0x5a, 0, 0, 0, 0, 0, 0]))
        sock1.pipe(sock2).pipe(sock1)
      })

      const { code, body } = await promise

      assert.strictEqual(code, 200)
      assert.strictEqual(body, 'foobaz')
    })
  })
}

describe('lib/request', () => {
  it('makes a request to the server', async () => {
    this.server = http.createServer((_, resp) => resp.end())
    await new Promise(resolve => this.server.listen(port, host, resolve))
    const { code, body } = await request('http://127.0.0.1:' + port)
    this.server.close()

    assert.strictEqual(code, 200)
    assert.strictEqual(body, '')
  })

  testSuite()
  testSuite(true)
})
