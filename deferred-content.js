(function() {
  'use strict';

  var privateData = new WeakMap()

  function fire(name, target) {
    setTimeout(function() {
      var event = target.ownerDocument.createEvent('Event')
      event.initEvent(name, true, true)
      target.dispatchEvent(event)
    }, 0)
  }

  function handleData(el, data) {
    return data.then(function(html) {
      el.insertAdjacentHTML('afterend', html)
      el.parentNode.removeChild(el)
    }, function() {
      el.classList.add('is-error')
    })
  }

  var DeferredContentPrototype = Object.create(window.HTMLElement.prototype)

  Object.defineProperty(DeferredContentPrototype, 'src', {
    get: function() {
      var src = this.getAttribute('src')
      if (src) {
        var link = this.ownerDocument.createElement('a')
        link.href = src
        return link.href
      } else {
        return ''
      }
    },
    set: function(value) {
      this.setAttribute('src', value)
    }
  })

  function getData(el) {
    var src = el.src
    var data = privateData.get(el)
    if (data && data.src === src) {
      return data.data
    } else {
      data = el.load(src)
      privateData.set(el, {src: src, data: data})
      return data
    }
  }

  Object.defineProperty(DeferredContentPrototype, 'data', {
    get: function() {
      return getData(this)
    }
  })

  DeferredContentPrototype.attributeChangedCallback = function(attrName) {
    // Reload data load cache
    if (attrName === 'src') {
      getData(this)
    }
  }

  DeferredContentPrototype.createdCallback = function() {
    // Preload data cache
    getData(this)
  }

  DeferredContentPrototype.attachedCallback = function() {
    handleData(this, getData(this))
  }

  DeferredContentPrototype.load = function(url) {
    var self = this

    if (!url) {
      return Promise.reject(new Error('missing src'))
    }

    fire('loadstart', self)
    return self.fetch(url).then(function(data) {
      fire('load', self)
      fire('loadend', self)
      return data
    }, function(error) {
      fire('error', self)
      fire('loadend', self)
      throw error
    })
  }

  DeferredContentPrototype.fetch = function(url) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        if (xhr.status === 200) {
          var ct = xhr.getResponseHeader('Content-Type')
          if (ct === 'text/html') {
            resolve(xhr.responseText)
          } else {
            reject(
              new Error('Failed to load resource: ' +
                'expected text/html but was ' + ct
              )
            )
          }
        } else {
          reject(
            new Error('Failed to load resource: ' +
              'the server responded with a status of ' +
              xhr.status)
          )
        }
      }

      xhr.onerror = reject

      xhr.open('GET', url)
      xhr.setRequestHeader('Accept', 'text/html')
      xhr.send()
    })
  }

  window.DeferredContentElement = document.registerElement('deferred-content', {
    prototype: DeferredContentPrototype
  })


  var PollDeferredContentPrototype = Object.create(DeferredContentPrototype)

  PollDeferredContentPrototype.fetch = function(url) {
    return new Promise(function(resolve, reject) {
      function poll(wait) {
        var xhr = new XMLHttpRequest()

        xhr.onload = function() {
          switch (xhr.status) {
            case 200:
              resolve(xhr.responseText)
              break
            case 202:
            case 404:
              window.setTimeout(function() {
                poll(wait * 1.5)
              }, wait)
              break
            default:
              reject()
              break
          }
        }

        xhr.onerror = function() {
          reject()
        }

        xhr.open('GET', url)
        xhr.send()
      }

      poll(1000)
    })
  }

  window.PollDeferredContentElement = document.registerElement('poll-deferred-content', {
    prototype: PollDeferredContentPrototype
  })
})();
