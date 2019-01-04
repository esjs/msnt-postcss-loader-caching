const fs = require('fs');

module.exports = {
  NAMESPACE: fs.realpathSync(__dirname),
}