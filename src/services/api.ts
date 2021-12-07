import axios, { AxiosError } from "axios";
import { parseCookies, setCookie } from "nookies";

let cookies = parseCookies();

export const api = axios.create({
	baseURL: "http://localhost:3333",
	headers: {
		Authorization: `Bearer ${cookies["nextauth.token"]}`,
	},
});

api.interceptors.response.use(
	(response) => {
		return response;
	},
	async (error: AxiosError) => {
		if (error.response.status === 401) {
			if (error.response.data?.code === "token.expired") {
				cookies = parseCookies();

				const { "nextauth.refreshToken": refreshToken } = cookies;
				const response = await api.post("refresh", {
					refreshToken,
				});

				const { token } = response.data;

				setCookie(undefined, "nextauth.token", token, {
					maxAge: 60 * 60 * 24 * 30, //30 days
					path: "/",
				});

				setCookie(undefined, "nextauth.refreshToken", response.data.refreshToken, {
					maxAge: 60 * 60 * 24 * 30, //30 days
				});

				api.defaults.headers["Authorization"] = `Bearer ${token}`;
			} else {
				//deslogar usuário
			}
		}
	}
);