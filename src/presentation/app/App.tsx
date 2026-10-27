import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { ResultsTable } from "../components/ResultsTable.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import { createApp } from "./createApp.tsx";

export const App = createApp({ Header, Prompt, ResultsTable, StatusBar });
