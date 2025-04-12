App({
  globalData: {
    userInfo: null,
    baseUrl: 'https://api.example.com', // 替换为实际的API地址
    token: '',
    isLogin: false
  },

  onLaunch() {
    // 获取本地存储的token
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.globalData.isLogin = true;
    }

    // 获取系统信息
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
        this.globalData.statusBarHeight = res.statusBarHeight;
      }
    });
  },

  // 检查登录状态
  checkLogin() {
    return new Promise((resolve, reject) => {
      if (this.globalData.isLogin) {
        resolve(true);
      } else {
        wx.navigateTo({
          url: '/pages/login/login'
        });
        reject(new Error('未登录'));
      }
    });
  },

  // 统一的请求方法
  request(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.globalData.token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            // token失效，重新登录
            this.globalData.isLogin = false;
            wx.navigateTo({
              url: '/pages/login/login'
            });
            reject(new Error('登录已过期'));
          } else {
            reject(new Error(res.data.message || '请求失败'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }
});
