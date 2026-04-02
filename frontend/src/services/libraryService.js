import api from './api.js';

// API returns bare arrays (not wrapped in { library: [] })
export const libraryService = {
  getLibrary: () =>
    api.get('/library').then(r => r.data),

  addItem: (item) =>
    api.post('/library', item).then(r => r.data),

  removeItem: (id) =>
    api.delete(`/library/${encodeURIComponent(id)}`).then(r => r.data),

  updateItem: (id, updates) =>
    api.put(`/library/${encodeURIComponent(id)}`, updates).then(r => r.data),
};
