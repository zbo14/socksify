# socksify

A library that adds SOCKS4(a) client support to core module functionality.

## Install

Clone the repo, `nvm i`, and `npm i`.

## Usage

### connect()

```js
/**
 * Adds SOCKS4(a) proxying support to net.connect() and tls.connect().
 * Resolves a net.Socket or tls.TLSSocket.
 *
 * @param  {Object}  opts
 * @param  {String}  opts.host            - the destination hostname
 * @param  {Number}  opts.port            - the destination port
 * @param  {String}  [opts.proxyHost]     - the proxy hostname
 * @param  {Number}  [opts.proxyPort]     - the proxy port
 * @param  {Boolean} [opts.secure]        - whether to establish TLS connection from proxy to destination
 * @param  {Number}  [opts.timeout = 5e3] - timeout to connect to destination/proxy
 *
 * @return {Promise}
 */
const connect = opts => {
  ...
}
```

### request()

```js
/**
 * Adds SOCKS4(a) proxying support to http.request() and https.request().
 * Resolves an object with the response status code, headers, and body.
 *
 * @param  {(String|URL)} url                         - the destination URL
 * @param  {Object}       [opts = {}]
 * @param  {String}       [opts.body]                 - the request body
 * @param  {Number}       [opts.connectTimeout]       - timeout for socksify.connect()
 * @param  {String}       [opts.proxyHost]            - the proxy hostname
 * @param  {Number}       [opts.proxyPort]            - the proxy port
 * @param  {Number}       [opts.requestTimeout = 5e3] - timeout for the HTTP(S) request
 * @param  {}             [opts....]                  - additional options for http.request() or https.request()
 *
 * @return {Promise}
 */

const request = async (url, opts = {}) => {
  ...
}
```

## Examples

The following examples assume top-level `async/await` and a SOCKS4(a) compatible proxy running on the local network at `192.168.1.10:12345`.

### Proxy a TCP/TLS connection

```js
'use strict'

const { connect } = require('socksify')

// Connect to the proxy and perform the handshake
const sock = await connect({
  host: 'www.foobar.com',
  port: 443,
  proxyHost: '192.168.1.10',
  proxyPort: 12345
})

// Now, data written to the socket will go to
// the proxy and *then* to "www.foobar.com".

...
```

### Proxy an HTTP(S) request

```js
'use strict'

const { request } = require('socksify')

const url = 'https://www.foobar.com/baz?q=1'

// Connect to the proxy and send an HTTPS request over the connection.
// The proxy forwards the request to "www.foobar.com" and the response to the client.
const { code, headers, body } = await request(url, {
  body: '...',
  proxyHost: '192.168.1.10',
  proxyPort: 12345
})

...
```

## Test

`npm test`

## Lint

`npm run lint`

## Documentation

`npm run doc`

Generate the documentation and open in browser.

## Contributing

Please do!

If you find a bug, want a feature added, or just have a question, feel free to [open an issue](https://github.com/zbo14/socksify/issues/new). In addition, you're welcome to [create a pull request](https://github.com/zbo14/socksify/compare/develop...) addressing an issue. You should push your changes to a feature branch and request merge to `develop`.

Make sure linting and tests pass and coverage is 💯 before creating a pull request!
