import { defineMcp } from "@lovable.dev/mcp-js";
import listVacancies from "./tools/list-vacancies";
import getVacancy from "./tools/get-vacancy";

export default defineMcp({
  name: "momento-careers-mcp",
  title: "InsurTalent Careers MCP",
  version: "0.1.0",
  instructions:
    "Tools for the InsurTalent careers site. Use `list_vacancies` to browse open roles and `get_vacancy` to fetch details for a specific role by slug.",
  tools: [listVacancies, getVacancy],
});
