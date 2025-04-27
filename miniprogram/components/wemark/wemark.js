const parser = require('./parser');

Component({
  properties: {
    md: {
      type: String,
      value: '',
      observer: function(md) {
        if (md) {
          this.parseMd(md);
        }
      }
    },
    type: {
      type: String,
      value: 'wemark'
    },
    highlight: {
      type: Boolean,
      value: false
    }
  },
  data: {
    parsedData: {}
  },
  methods: {
    parseMd: function(md) {
      if (!md) {
        return;
      }
      var parsedData = parser.parse(md, {
        highlight: this.data.highlight
      });
      this.setData({
        parsedData
      });
    }
  }
});
