const { NAMESPACE } = require('./config');

class MsntPostcssCachingPlugin {
  get NAMESPACE() {
    return NAMESPACE;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(NAMESPACE, compilation => {
      const time = new Date().getTime();

      compilation.hooks.normalModuleLoader.tap(NAMESPACE, loaderContext => {
        this.msntCompilationStartTime = time; 
      })
    });
  }
}

module.exports = MsntPostcssCachingPlugin;