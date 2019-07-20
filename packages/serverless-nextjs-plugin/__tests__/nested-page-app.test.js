const nextBuild = require("next/dist/build");
const path = require("path");
const Serverless = require("serverless");
const AdmZip = require("adm-zip");
const readCloudFormationUpdateTemplate = require("../utils/test/readCloudFormationUpdateTemplate");

jest.mock("next/dist/build");

describe("nested page app", () => {
  const fixturePath = path.join(__dirname, "./fixtures/nested-page-app");

  let tmpCwd;
  let cloudFormationUpdateResources;

  beforeAll(async () => {
    nextBuild.default.mockResolvedValue();

    tmpCwd = process.cwd();
    process.chdir(fixturePath);

    const serverless = new Serverless();

    serverless.invocationId = "test-run";

    process.argv[2] = "package";

    await serverless.init();
    await serverless.run();

    const cloudFormationUpdateTemplate = await readCloudFormationUpdateTemplate(
      fixturePath
    );
    cloudFormationUpdateResources = cloudFormationUpdateTemplate.Resources;
  });

  afterAll(() => {
    process.chdir(tmpCwd);
  });

  describe("Page lambda function", () => {
    let pageLambda;

    beforeAll(() => {
      pageLambda = cloudFormationUpdateResources.BlogDashpostLambdaFunction;
    });

    it("creates lambda resource", () => {
      expect(pageLambda).toBeDefined();
    });

    it("has correct handler", () => {
      expect(pageLambda.Properties.Handler).toEqual(
        "sls-next-build/blog/post.render"
      );
    });
  });

  describe("Api Gateway", () => {
    let apiGateway;

    beforeAll(() => {
      apiGateway = cloudFormationUpdateResources.ApiGatewayRestApi;
    });

    it("creates api resource", () => {
      expect(apiGateway).toBeDefined();
    });

    describe("Page route", () => {
      it("creates page route resource with correct path", () => {
        const blogResource =
          cloudFormationUpdateResources.ApiGatewayResourceBlog;

        const blogPostResource =
          cloudFormationUpdateResources.ApiGatewayResourceBlogPost;

        expect(blogResource).toBeDefined();
        expect(blogPostResource).toBeDefined();
        expect(blogResource.Properties.PathPart).toEqual("blog");
        expect(blogPostResource.Properties.PathPart).toEqual("post");
      });

      it("creates GET http method", () => {
        const httpMethod =
          cloudFormationUpdateResources.ApiGatewayMethodBlogPostGet;

        expect(httpMethod).toBeDefined();
        expect(httpMethod.Properties.HttpMethod).toEqual("GET");
        expect(httpMethod.Properties.ResourceId.Ref).toEqual(
          "ApiGatewayResourceBlogPost"
        );
      });

      it("creates HEAD http method", () => {
        const httpMethod =
          cloudFormationUpdateResources.ApiGatewayMethodBlogPostHead;

        expect(httpMethod).toBeDefined();
        expect(httpMethod.Properties.HttpMethod).toEqual("HEAD");
        expect(httpMethod.Properties.ResourceId.Ref).toEqual(
          "ApiGatewayResourceBlogPost"
        );
      });
    });
  });

  describe("Zip artifact", () => {
    let zipEntryNames;

    beforeAll(() => {
      const zip = new AdmZip(
        `${fixturePath}/.serverless/one-page-app-fixture.zip`
      );
      const zipEntries = zip.getEntries();
      zipEntryNames = zipEntries.map(ze => ze.entryName);
    });

    it("contains next compiled page", () => {
      expect(zipEntryNames).toContain(`sls-next-build/blog/post.original.js`);
    });

    it("contains plugin handler", () => {
      expect(zipEntryNames).toContain(`sls-next-build/blog/post.js`);
    });
  });
});