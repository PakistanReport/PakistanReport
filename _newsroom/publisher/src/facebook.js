export class FacebookError extends Error {
  constructor(message, { transient = false, retryAfter = 0 } = {}) {
    super(message);
    this.name = "FacebookError";
    this.transient = transient;
    this.retryAfter = retryAfter;
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
      // Keep the error generic so response bodies cannot leak credentials.
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

      throw new FacebookError("Facebook rejected the post.", {
        transient,
        retryAfter: Number.isFinite(retryAfter) ? retryAfter : 0,
      });
    }

    return data.id;
  }
}