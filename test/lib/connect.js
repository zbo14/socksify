'use strict'

const assert = require('assert')
const { once } = require('events')
const lolex = require('lolex')
const net = require('net')
const { TLSSocket } = require('tls')
const connect = require('../../lib/connect')

const host = '1.2.3.4'
const port = 1234
const proxyPort = 8081
const proxyHost = '127.0.0.1'

const testSuite = secure => {
  const Socket = secure ? TLSSocket : net.Socket

  describe(secure ? 'tls' : 'net', () => {
    beforeEach(done => {
      this.clock = lolex.install()
      this.proxy = net.createServer()
      this.proxy.listen(proxyPort, proxyHost, done)
    })

    afterEach(() => {
      this.proxy.close()
      this.clock.uninstall()
    })

    it('mocks connection without using proxy', async () => {
      const promise = once(this.proxy, 'connection')
      await connect({ host: proxyHost, port: proxyPort, secure })
      await promise
    })

    it('times out when proxy doesn\'t complete handshake', async () => {
      this.proxy.once('connection', sock => {
        sock.write(Buffer.from([0]))
        this.clock.tick(5e3)
      })

      try {
        await connect({ host, port, proxyHost, proxyPort, secure })
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'Request timeout')
      }
    })

    it('mocks successful SOCKS4 handshake where proxy sends 1 byte at a time', async () => {
      const promise = (async () => {
        const [sock] = await once(this.proxy, 'connection')
        sock.write(Buffer.from([0, 0x5a]))
        let data = Buffer.alloc(0)

        while (data.byteLength < 9) {
          const [chunk] = await once(sock, 'data')
          data = Buffer.concat([data, chunk])
        }

        assert.deepStrictEqual(data, Buffer.from([
          4,
          1,
          4, 210,
          1, 2, 3, 4,
          0
        ]))
      })()

      const [result] = await Promise.all([
        connect({ host, port, proxyHost, proxyPort, secure }),
        promise
      ])

      assert(result instanceof Socket)
    })

    it('mocks successful SOCKS4a handshake', async () => {
      const host = 'foobar.com'
      const hostLen = Buffer.from(host).byteLength
      const port = secure ? 443 : 80
      const portBuf = Buffer.alloc(2)
      portBuf.writeUInt16BE(port)

      const promise = (async () => {
        const [sock] = await once(this.proxy, 'connection')
        sock.write(Buffer.from([0, 0x5a]))
        let data = Buffer.alloc(0)

        while (data.byteLength < 10 + hostLen) {
          const [chunk] = await once(sock, 'data')
          data = Buffer.concat([data, chunk])
        }

        assert.deepStrictEqual(data, Buffer.from([
          4,
          1,
          ...portBuf,
          0, 0, 0, 1,
          0,
          ...Buffer.from('foobar.com'),
          0
        ]))
      })()

      const [result] = await Promise.all([
        connect({ host, port, proxyHost, proxyPort }),
        promise
      ])

      assert(result instanceof Socket)
    })

    it('mocks protocol violation', async () => {
      this.proxy.once('connection', sock => sock.write(Buffer.from([1])))

      try {
        await connect({ host, port, proxyHost, proxyPort, secure })
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'Expected null byte')
      }
    })

    it('mocks general request failure', async () => {
      this.proxy.once('connection', sock => sock.write(Buffer.from([0, 0x5b])))

      try {
        await connect({ host, port, proxyHost, proxyPort, secure })
        assert.fail('Should reject')
      } catch ({ message }) {
        assert.strictEqual(message, 'Request failed')
      }
    })
  })
}

describe('lib/connect', () => {
  testSuite()
  testSuite(true)
})
