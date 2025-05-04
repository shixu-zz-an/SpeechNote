const app = getApp()

Page({
  data: {
    orders: []
  },

  onLoad() {
    this.loadOrders()
  },

  onShow() {
    this.loadOrders()
  },

  loadOrders() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/subscription/orders`,
      method: 'GET',
      header: {
        'Authorization': `${app.globalData.token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const orders = res.data.map(order => ({
            ...order,
            statusText: this.getStatusText(order.status),
            createTime: this.formatTime(order.createTime)
          }))
          this.setData({ orders })
        }
      }
    })
  },

  getStatusText(status) {
    const statusMap = {
      'UNPAID': '未支付',
      'PAID': '已支付',
      'CANCELLED': '已取消',
      'EXPIRED': '已过期'
    }
    return statusMap[status] || '未知状态'
  },

  formatTime(timestamp) {
    const date = new Date(timestamp)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  },

  cancelOrder(e) {
    const orderId = e.currentTarget.dataset.orderId
    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.baseUrl}/api/subscription/order/${orderId}/cancel`,
            method: 'POST',
            header: {
              'Authorization': `${app.globalData.token}`
            },
            success: (res) => {
              if (res.statusCode === 200) {
                wx.showToast({
                  title: '取消成功',
                  icon: 'success'
                })
                this.loadOrders()
              }
            }
          })
        }
      }
    })
  },

  repayOrder(e) {
    const orderId = e.currentTarget.dataset.orderId
    wx.request({
      url: `${app.globalData.baseUrl}/api/subscription/order/${orderId}/repay`,
      method: 'POST',
      header: {
        'Authorization': ` ${app.globalData.token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 调用微信支付
          wx.requestPayment({
            ...res.data,
            success: () => {
              wx.showToast({
                title: '支付成功',
                icon: 'success'
              })
              this.loadOrders()
            },
            fail: () => {
              wx.showToast({
                title: '支付失败',
                icon: 'error'
              })
            }
          })
        }
      }
    })
  },

  closeOrder(e) {
    const orderId = e.currentTarget.dataset.orderId
    wx.showModal({
      title: '确认关闭',
      content: '确定要关闭该订单吗？关闭后将无法再次支付。',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.baseUrl}/api/subscription/order/${orderId}/close`,
            method: 'POST',
            header: {
              'Authorization': `${app.globalData.token}`
            },
            success: (res) => {
              if (res.statusCode === 200) {
                wx.showToast({
                  title: '关闭成功',
                  icon: 'success'
                })
                this.loadOrders()
              }
            }
          })
        }
      }
    })
  }
}) 