import handler from "./api/index.js";
const req = {
  method: "POST",
  path: "/api/auth/login",
  url: "/api/auth/login",
  headers: {},
  body: {password: "test"},
  on: () => {},
};
const res = {
  status: (c: number) => {
    console.log("STATUS:", c);
    return res;
  },
  json: (j: any) => {
    console.log("JSON:", j);
  },
  on: () => {},
  end: () => {},
  setHeader: () => {},
};

(async () => {
  await handler(req as any, res as any, () => {
    console.log("NEXT CALLED");
  });
})();
