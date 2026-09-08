import api from './axios'

export const getTuitionCategories  = () => api.get('/payments/categories/')
export const createTuitionCategory = (data) => api.post('/payments/categories/', data)

export const getTuitionTemplates  = () => api.get('/payments/templates/')
export const createTuitionTemplate = (data) => api.post('/payments/templates/', data)

export const setGroupTuition = (groupId, templateId) =>
  api.put(`/payments/groups/${groupId}/tuition/`, { template: templateId })

export const getStudentTuitionOverride = (studentId, groupId) =>
  api.get(`/payments/students/${studentId}/groups/${groupId}/override/`)
export const setStudentTuitionOverride = (studentId, groupId, customPrice) =>
  api.put(`/payments/students/${studentId}/groups/${groupId}/override/`, { custom_price: customPrice })

export const getBalances = (params) => api.get('/payments/balances/', { params })

// Downloads the balance list as .xlsx — filename comes from the server's
// Content-Disposition header (differs whether it's the whole academy or
// one group), so this reads that instead of hardcoding a name.
export const exportBalancesExcel = async (params) => {
  const res = await api.get('/payments/balances/export/', { params, responseType: 'blob' })
  const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')
  const filename = match ? match[1] : 'balans.xlsx'
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
export const recordPayment = (data) => api.post('/payments/record/', data)
export const getPaymentHistory = (params) => api.get('/payments/history/', { params })
export const getMyPayments = () => api.get('/payments/mine/')
export const voidPayment = (paymentId) => api.delete(`/payments/${paymentId}/`)

// Returns the PDF as a Blob for preview (e.g. in an <iframe> via
// URL.createObjectURL) — does not trigger a download itself. See
// components/ReceiptPreviewModal.jsx, which shows the receipt first and
// lets the viewer choose to download it, rather than downloading blind.
export const fetchReceiptBlob = async (paymentId) => {
  const res = await api.get(`/payments/${paymentId}/receipt/`, { responseType: 'blob' })
  return res.data
}
