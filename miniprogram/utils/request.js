const app = getApp();

const request = (options) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${app.globalData.token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // token失效，重新登录
          app.globalData.isLogin = false;
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
};

const uploadFile = (options) => {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: app.globalData.baseUrl + options.url,
      filePath: options.filePath,
      name: options.name || 'file',
      header: {
        'Authorization': `Bearer ${app.globalData.token}`
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
        } else if (res.statusCode === 401) {
          app.globalData.isLogin = false;
          wx.navigateTo({
            url: '/pages/login/login'
          });
          reject(new Error('登录已过期'));
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
