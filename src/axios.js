import axios from "axios";



let axiosConfig = {
  baseURL: "http://localhost:3001",
  withCredentials: true,
};

if (import.meta.env.VITE_ENV === "prod") {
  axiosConfig = {
    baseURL: "http://13.60.249.224:3001",
    withCredentials: true,
  };
}

const api = axios.create(axiosConfig);

export default api;