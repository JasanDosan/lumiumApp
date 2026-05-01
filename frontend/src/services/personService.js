import api from './api';

export const personService = {
  getPerson: (id) => api.get(`/people/${id}`).then(r => r.data),
};
