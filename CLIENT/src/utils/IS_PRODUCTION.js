import env from "../utils/env";

const IS_PRODUCTION = env("SERVER_URL").includes("https");

export default IS_PRODUCTION;
