const app = getApp();

const request = (options) => {
  return new Promise((resolve, reject) => {
    // 如果没有登录，先进行登录
    if (!app.globalData.isLogin && !options.noAuth) {
      wx.navigateTo({
        url: '/pages/login/login'
      });
      reject(new Error('请先登录'));
      return;
    }

    wx.request({
      url: app.globalData.baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': app.globalData.token
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401 || (res.data && res.data.code === 401)) {
          // token失效，重新登录
          app.reLogin().then(newToken => {
            // 使用新token重新请求
            options.header = options.header || {};
            options.header['Authorization'] = newToken;
            // 重新调用请求
            request(options).then(resolve).catch(reject);
          }).catch(err => {
            // 重新登录失败，跳转到登录页
            app.globalData.isLogin = false;
            wx.navigateTo({
              url: '/pages/login/login'
            });
            reject(err);
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
};

const uploadFile = (options) => {
  return new Promise((resolve, reject) => {
    // 如果没有登录，先进行登录
    if (!app.globalData.isLogin) {
      wx.navigateTo({
        url: '/pages/login/login'
      });
      reject(new Error('请先登录'));
      return;
    }

    wx.uploadFile({
      url: app.globalData.baseUrl + options.url,
      filePath: options.filePath,
      name: options.name || 'file',
      header: {
        'Authorization': app.globalData.token
      },
      formData: options.formData || {},
      success: (res) => {
        if (res.statusCode === 200) {
          let data = res.data;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (e) {
              reject(new Error('解析响应数据失败'));
              return;
            }
          }
          resolve(data);
        } else if (res.statusCode === 401 || (res.data && res.data.code === 401)) {
          // token失效，重新登录
          app.reLogin().then(newToken => {
            // 使用新token重新请求
            options.header = options.header || {};
            options.header['Authorization'] = newToken;
            // 重新调用上传
            uploadFile(options).then(resolve).catch(reject);
          }).catch(err => {
            app.globalData.isLogin = false;
            wx.navigateTo({
              url: '/pages/login/login'
            });
            reject(err);
          });
        } else {
          reject(new Error('上传失败'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

module.exports = {
  request,
  uploadFile
};
