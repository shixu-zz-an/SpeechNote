App({
  globalData: {
    userInfo: null,
    // baseUrl: 'https://asr.aipromaker.cn', // 修改为实际的API地址
    // wsUrl:'wss://asr.aipromaker.cn',
    // baseUrl: 'https://www.speevolt.cn', // 修改为实际的API地址
    // wsUrl:'wss://www.speevolt.cn',
    baseUrl: 'http://192.168.0.101:9001', // 修改为实际的API地址
    wsUrl:'ws://192.168.0.101:9001',
    token: '',
    isLogin: false,
    needRefreshMeetings: false,
    isNavigatingToLogin: false // 添加标志位以防止重复跳转
  },

  onLaunch() {
    // 获取本地存储的token和用户信息
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token) {
      this.globalData.token = token;
      this.globalData.isLogin = true;
    }
    
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }

    // 获取系统信息
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
        this.globalData.statusBarHeight = res.statusBarHeight;
      }
    });
  },

  // 添加统一的跳转到登录页面的方法
  navigateToLogin() {
    if (this.globalData.isNavigatingToLogin) {
      return; // 如果已经在跳转中，直接返回
    }
    
    this.globalData.isNavigatingToLogin = true;
    wx.navigateTo({
      url: '/pages/login/login',
      complete: () => {
        // 延迟一段时间后重置标志位
        setTimeout(() => {
          this.globalData.isNavigatingToLogin = false;
        }, 1000); // 等待一段时间后重置标志位
      }
    });
  },

  // 检查登录状态
  checkLogin() {
    return new Promise((resolve, reject) => {
      if (this.globalData.isLogin) {
        resolve(true);
      } else {
        // 跳转到登录页面
        this.navigateToLogin();
        reject(new Error('未登录'));
      }
    });
  },

  // 重新登录
  reLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            // 调用后端登录接口
            wx.request({
              url: `${this.globalData.baseUrl}/api/wx/login`,
              method: 'GET',
              data: { code: res.code },
              success: (loginRes) => {
                if (loginRes.statusCode === 200 && loginRes.data && loginRes.data.data && loginRes.data.data.jwtToken) {
                  // 保存token
                  this.globalData.token = loginRes.data.data.jwtToken;
                  this.globalData.isLogin = true;
                  wx.setStorageSync('token', loginRes.data.data.jwtToken);
                  resolve(loginRes.data.data.jwtToken);
                } else {
                  this.globalData.isLogin = false;
                  wx.removeStorageSync('token');
                  reject(new Error(loginRes.data.message || '登录失败'));
                }
              },
              fail: (err) => {
                reject(err);
              }
            });
          } else {
            reject(new Error('获取微信登录码失败'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 统一的请求方法
  request(options) {
    return new Promise((resolve, reject) => {
      // 如果没有登录且不是不需要授权的请求，则返回错误信息
      if (!this.globalData.isLogin && !options.noAuth) {
        reject(new Error('NEED_LOGIN')); // 返回特定错误码
        return;
      }

      wx.request({
        url: this.globalData.baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          'Authorization': this.globalData.token
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else if (res.statusCode === 401 || (res.data && res.data.code === 401)) {
            // token失效，重新登录
            this.reLogin().then(newToken => {
              // 使用新token重新请求
              options.header = options.header || {};
              options.header['Authorization'] = newToken;
              this.request(options).then(resolve).catch(reject);
            }).catch(err => {
              // 重新登录失败，返回需要登录错误
              this.globalData.isLogin = false;
              reject(new Error('NEED_LOGIN'));
            });
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
