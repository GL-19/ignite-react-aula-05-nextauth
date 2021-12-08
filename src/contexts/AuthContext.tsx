import { createContext, ReactNode, useEffect, useState } from "react";
import Router from "next/router";
import { destroyCookie, parseCookies, setCookie } from "nookies";
import { api } from "../services/apiClient";

type User = {
	email: string;
	permissions: string[];
	roles: string[];
};

type SignInCredentials = {
	email: string;
	password: string;
};

type AuthContextData = {
	signIn: (credentials: SignInCredentials) => Promise<void>;
	signOut: () => void;
	isAuthenticated: boolean;
	user: User;
};

interface AuthProviderProps {
	children: ReactNode;
}

export const AuthContext = createContext({} as AuthContextData);

let authChannel: BroadcastChannel;

export function signOut() {
	destroyCookie(undefined, "nextauth.token");
	destroyCookie(undefined, "nextauth.refreshToken");

	authChannel.postMessage("signOut");

	Router.push("/");
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User>();
	const isAuthenticated = !!user;

	useEffect(() => {
		authChannel = new BroadcastChannel("auth");

		authChannel.onmessage = (message) => {
			console.log(message);

			switch (message.data) {
				case "signOut":
					signOut();
					break;
				default:
					break;
			}
		};
	}, []);

	useEffect(() => {
		const { "nextauth.token": token } = parseCookies();

		if (token) {
			api
				.get("/me")
				.then((response) => {
					const { email, roles, permissions } = response.data;

					setUser({ email, roles, permissions });
				})
				.catch(() => {
					signOut();
				});
		}
	}, []);

	async function signIn({ email, password }: SignInCredentials) {
		try {
			const response = await api.post("sessions", {
				email,
				password,
			});

			const { token, refreshToken, permissions, roles } = response.data;

			setCookie(undefined, "nextauth.token", token, {
				maxAge: 60 * 60 * 24 * 30, //30 days
				path: "/",
			});

			setCookie(undefined, "nextauth.refreshToken", refreshToken, {
				maxAge: 60 * 60 * 24 * 30, //30 days
			});

			setUser({
				email,
				permissions,
				roles,
			});

			api.defaults.headers["Authorization"] = `Bearer ${token}`;

			Router.push("/dashboard");
		} catch (error) {
			console.log("Error: ", error);
		}
	}

	return (
		<AuthContext.Provider value={{ isAuthenticated, signIn, user, signOut }}>
			{children}
		</AuthContext.Provider>
	);
}
