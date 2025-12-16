import axios from 'axios';

const API_URL = 'http://localhost:3000';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const workspaceApi = {
    createWorkspace: async (data) => {
        const response = await api.post('/api/v2/workspace', data);
        return response.data?.data || response.data;
    },
    getWorkspace: async (id) => {
        const response = await api.get(`/api/v2/workspace/${id}`);
        return response.data?.data || response.data;
    },
    updateWorkspace: async (data) => {
        const response = await api.patch('/api/v2/workspace', data);
        return response.data?.data || response.data;
    },
    updateFiles: async (data) => {
        const response = await api.patch('/api/v2/workspace/files', data);
        return response.data?.data || response.data;
    }
};
