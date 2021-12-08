import Router from "next/router";
import axios, { AxiosError } from "axios";
import { destroyCookie, parseCookies, setCookie } from "nookies";

let cookies = parseCookies();
let isRefreshing = false;
let failedRequestsQueue = [];

export const api = axios.create({
	baseURL: "http://localhost:3333",
	headers: {
		Authorization: `Bearer ${cookies["nextauth.token"]}`,
	},
});

export function signOut() {
	destroyCookie(undefined, "nextauth.token");
	destroyCookie(undefined, "nextauth.refreshToken");

	Router.push("/");
}

api.interceptors.response.use(
	(response) => {
		return response;
	},
	(error: AxiosError) => {
		if (error.response.status === 401) {
			// refresh token logic
			if (error.response.data?.code === "token.expired") {
				cookies = parseCookies();

				const { "nextauth.refreshToken": refreshToken } = cookies;
				const originalConfig = error.config;

				if (!isRefreshing) {
					isRefreshing = true;

					api
						.post("refresh", {
							refreshToken,
						})
						.then((response) => {
							const { token, refreshToken: newRefreshToken } = response.data;

							setCookie(undefined, "nextauth.token", token, {
								maxAge: 60 * 60 * 24 * 30, //30 days
								path: "/",
							});

							setCookie(undefined, "nextauth.refreshToken", newRefreshToken, {
								maxAge: 60 * 60 * 24 * 30, //30 days
							});

							api.defaults.headers["Authorization"] = `Bearer ${token}`;

							failedRequestsQueue.forEach((request) => request.onSuccess(token));
							failedRequestsQueue = [];
						})
						.catch((error) => {
							failedRequestsQueue.forEach((request) => request.onFailure(error));
							failedRequestsQueue = [];
						})
						.finally(() => {
							isRefreshing = false;
						});
				}

				return new Promise((resolve, reject) => {
					failedRequestsQueue.push({
						onSuccess: (token: string) => {
							originalConfig.headers["Authorization"] = `Bearer ${token}`;

							resolve(api(originalConfig));
						},
						onFailure: (error: AxiosError) => {
							reject(error);
						},
					});
				});
			} else {
				signOut();
			}
		}

		return Promise.reject(error);
	}
);
