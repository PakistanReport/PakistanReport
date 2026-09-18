export class FacebookError extends Error {
  constructor(message, { transient = false, retryAfter = 0, code = null, type = null } = {}) {
    super(message);
    this.name = "FacebookError";
    this.transient = transient;
    this.retryAfter = retryAfter;
    this.code = Number.isInteger(code) ? code : null;
    this.type = typeof type === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(type) ? type : null;
  }
}

export class Facebook {
  constructor(pageId, accessToken) {
    this.pageId = pageId;
    this.accessToken = accessToken;
  }

  async publish({ message, link }) {
    if (!this.pageId || !this.accessToken) {
      throw new FacebookError("Facebook publishing is not configured.");
    }

    const body = new URLSearchParams({
      message,
      link,
      access_token: this.accessToken,
    });

    let response;

    try {
      response = await fetch(
        `https://graph.facebook.com/${this.pageId}/feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
    } catch {
      throw new FacebookError("Facebook request failed.", {
        transient: true,
      });
    }

    let data = {};

    try {
      data = await response.json();
    } catch {
      // Never retain or expose the raw Graph response.
    }

    if (!response.ok || !data.id) {
      const transient =
        response.status === 429 ||
        response.status >= 500 ||
        data?.error?.is_transient === true;

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : 0;

      const code = Number.isInteger(data?.error?.code) ? data.error.code : null;
      const type =
        typeof data?.error?.type === "string" ? data.error.type : null;
      const diagnostic = [
        code !== null ? `code ${code}` : null,
        type && /^[A-Za-z0-9_.-]{1,80}$/.test(type) ? `type ${type}` : null,
      ].filter(Boolean).join(", ");

      throw new FacebookError(
        diagnostic ? `Facebook rejected the post (${diagnostic}).` : "Facebook rejected the post.",
        {
          transient,
          retryAfter: Number.isFinite(retryAfter) ? retryAfter : 0,
          code,
          type,
        },
      );
    }

    return data.id;
  }
}
