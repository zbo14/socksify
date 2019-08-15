'use strict'

const http = require('http')
const https = require('https')
const connect = require('./connect')

/** @module request */

/**
 * Adds SOCKS4(a) proxying support to http.request() and https.request().
 * Resolves an object with the response status code, headers, and body.
 *
 * @param  {(String|URL)} url              - the destination URL
 * @param  {Object}       [opts = {}]
 * @param  {String}       [opts.body]      - the request body
 * @param  {String}       [opts.proxyHost] - the proxy hostname
 * @param  {Number}       [opts.proxyPort] - the proxy port
 * @param  {}             [opts....]       - additional options for http.request() or https.request()
 *
 * @return {Promise}
 */
const request = async (url, opts = {}) => {
  const { hostname: host, port, protocol } = new URL(url)
  const secure = protocol === 'https:'
  const sock = await connect({ ...opts, host, port, secure })
  const createConnection = () => sock
  const { request } = secure ? https : http

  const result = await new Promise((resolve, reject) => {
    request({ ...opts, createConnection, host, port }, resp => {
      const { statusCode: code, headers } = resp

      let body = ''

      resp
        .once('end', () => resolve({ body, code, headers }))
        .once('error', reject)
        .on('data', chunk => {
          body += chunk
        })
    }).once('error', reject)
      .end(opts.body ? opts.body : '')
  })

  return result
}

module.exports = request
