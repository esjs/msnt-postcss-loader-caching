const fs = require('fs');

const { NAMESPACE } = require('./config');

const cache = new Map();

// holds refrences to pitch callbacks for files that are already processing 
const sameFileCompilationQueue = new Map();

let lastCompilationStartTime;

function pitch(remainingRequest, precedingRequest, data) {
  const plugin = findPlugin(this);
  const compilationStartTime = plugin.msntCompilationStartTime;

  // clear all previously stored queues
  if (compilationStartTime !== lastCompilationStartTime) {
    lastCompilationStartTime = compilationStartTime;
    sameFileCompilationQueue.clear();
  }

  let cachedFile = cache.get(this.resourcePath);

  if (cachedFile) {
    // if we have cached file, check that it was cached for this compilation
    if (cachedFile.lastChecked !== compilationStartTime) {
      // if it's new compilation, force check for mtime
      Object.assign(cachedFile, {
        lastChecked: compilationStartTime,
        useCache: false,
      });

    // if we previously detected that file didn't changed for this compilation
    // or if we already processed this file, just use cache
    } else if (cachedFile.useCache) {
      this.loaders = this.loaders.filter(
        (loader, index) => index <= this.loaderIndex
      );

      return;
    }
  }

  const cb = this.async();

  // if file is already processing, add it to sucessfull compilation queue
  // remove any proceding loader and wait till compilation ends and callback called
  if (sameFileCompilationQueue.has(this.resourcePath)) {
    const queue = sameFileCompilationQueue.get(this.resourcePath);

    this.loaders = this.loaders.filter(
      (loader, index) => index <= this.loaderIndex
    );

    queue.push(cb);

    return;
  }

  // create queue for this file if it's the first one
  sameFileCompilationQueue.set(this.resourcePath, []);

  fs.stat(this.resourcePath, (err, result) => {
    const { mtime } = result;

    if (!cachedFile) {
      cache.set(this.resourcePath, {
        mtime,
        lastChecked: compilationStartTime
      });

    // if new compilation but file didn't change, use old values
    } else if (cachedFile.mtime === mtime) {
      cachedFile.useCache = true;

      this.loaders = this.loaders.filter(
        (loader, index) => index <= this.loaderIndex
      );
    
    // if file changed since last compilation, force recompilation
    } else {
      Object.assign(cachedFile, {
        useCache: false,
        mtime
      });
    }

    cb();
  });
}

function loader(css, map, meta) {
  const cachedFile = cache.get(this.resourcePath);
  const queue = sameFileCompilationQueue.get(this.resourcePath);

  let result;

  if (cachedFile && cachedFile.useCache) {
    result = [null, cachedFile.css, map, cachedFile.meta];

  // after file compiled, cache it, and mark that it's safe to use cached value
  } else {
    Object.assign(cachedFile, {
      useCache: true,
      css,
      map,
      meta
    });

    result = [null, css, map, meta];
  }
  
  this.callback(...result);

  // if there are other calls to compilation of this file,
  // then we need to resolve them and clear queue
  if (queue) {
    queue.forEach(cb => cb());
    sameFileCompilationQueue.delete(this.resourcePath);
  }
}

/**
 * Helper method to find reference to loaders plugin
 */
function findPlugin(loader) {
  const compiler = loader._compiler;
  const isChildCompiler = compiler.isChild();
  const parentCompiler = isChildCompiler
    ? compiler.parentCompilation.compiler
    : null;
  const plugin = parentCompiler
    ? parentCompiler.options.plugins.find(
        p => p.NAMESPACE && p.NAMESPACE === NAMESPACE
      )
    : this[NAMESPACE];

  return plugin;
}

module.exports = loader;
module.exports.pitch = pitch;
