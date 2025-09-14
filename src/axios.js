import axios from "axios";



let axiosConfig = {
  baseURL: "http://localhost:3001",
  withCredentials: true,
};



if (import.meta.env.VITE_ENV === "prod") {
  axiosConfig = {
    baseURL: "http://112.134.131.151",
    withCredentials: true,
  };
}
console.log(axiosConfig)


const api = axios.create(axiosConfig);

export default api;