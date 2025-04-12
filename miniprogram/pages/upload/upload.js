const app = getApp();
const { uploadFile } = require('../../utils/request');
const { formatFileSize } = require('../../utils/util');

Page({
  data: {
    selectedFile: null,
    uploading: false,
    uploadProgress: 0,
    audioFormats: '.mp3、.wav、.m4a、.wma、.aac、.ogg、.amr、.flac',
    videoFormats: '.mp4、.wmv、.m4v、.flv、.rmvb、.dat、.mov、.mkv、.webm',
    allowedExtensions: [
      'mp3', 'wav', 'm4a', 'wma', 'aac', 'ogg', 'amr', 'flac',
      'mp4', 'wmv', 'm4v', 'flv', 'rmvb', 'dat', 'mov', 'mkv', 'webm'
    ]
  },

  handleBack() {
    wx.navigateBack();
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: this.data.allowedExtensions,
      success: (res) => {
        const file = res.tempFiles[0];
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        // 检查文件格式和大小
        if (['.mp3', '.wav', '.m4a', '.wma', '.aac', '.ogg', '.amr', '.flac'].includes(extension)) {
          if (file.size > 500 * 1024 * 1024) { // 500MB
            wx.showToast({
              title: '音频文件大小不能超过500MB',
              icon: 'none'
            });
            return;
          }
        } else if (['.mp4', '.wmv', '.m4v', '.flv', '.rmvb', '.dat', '.mov', '.mkv', '.webm'].includes(extension)) {
          if (file.size > 6 * 1024 * 1024 * 1024) { // 6GB
            wx.showToast({
              title: '视频文件大小不能超过6GB',
              icon: 'none'
            });
            return;
          }
        } else {
          wx.showToast({
            title: '不支持的文件格式',
            icon: 'none'
          });
          return;
        }

        this.setData({
          selectedFile: {
            name: file.name,
            path: file.path,
            size: file.size
          }
        });
      }
    });
  },

  async handleUpload() {
    if (!this.data.selectedFile) {
      wx.showToast({
        title: '请先选择文件',
        icon: 'none'
      });
      return;
    }

    const file = this.data.selectedFile;
    this.setData({ uploading: true, uploadProgress: 0 });

    try {
      const result = await uploadFile({
        url: '/api/upload',
        filePath: file.path,
        name: 'file',
        formData: {
          fileName: file.name
        },
        onProgressUpdate: (res) => {
          this.setData({
            uploadProgress: res.progress
          });
        }
      });

      wx.showToast({
        title: '上传成功',
        icon: 'success'
      });

      // 上传成功后返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      wx.showToast({
        title: error.message || '上传失败',
        icon: 'none'
      });
    } finally {
      this.setData({ uploading: false, uploadProgress: 0 });
    }
  }
});
