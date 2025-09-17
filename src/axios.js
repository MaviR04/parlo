import axios from "axios";



let axiosConfig = {
  baseURL: "http://16.171.37.171:3001",
  withCredentials: true,
};



if (import.meta.env.VITE_ENV === "prod") {
  axiosConfig = {
    baseURL: "http://16.171.37.171:3001",
    withCredentials: true,
  };
}
console.log(axiosConfig)


const api = axios.create(axiosConfig);

export default api;