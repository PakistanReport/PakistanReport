# Recent section listings and stable monthly archives.
module PakistanReport
  class CategoryPagination < Jekyll::Generator
    safe true
    priority :low
    PER_PAGE = 48
    ACTIVE = ["Pakistan", "Politics", "Economy", "Business", "World", "Technology"].freeze

    def generate(site)
      posts = site.posts.docs.sort_by(&:date).reverse
      site.pages.select { |p| p.data["layout"] == "category" }.each do |page|
        categories = Array(page.data["categories"] || page.data["category"])
        page.data["category_page_posts"] = posts.select { |p| categories.include?(p.data["category"]) }.first(PER_PAGE)
        page.data["show_news_archive"] = categories.length == 1 && ACTIVE.include?(categories.first)
      end
      site.pages.select { |p| p.data["latest_archive"] == true }.each do |page|
        page.data["latest_page_posts"] = posts.reject { |p| ["Iran Conflict", "Jobs", "Explainer"].include?(p.data["category"]) }.first(PER_PAGE)
      end
      months = posts.group_by { |p| p.date.getlocal("+05:00").strftime("%Y/%m") }
      index = site.pages.find { |p| p.data["news_archive_index"] == true }
      raise "Missing news archive landing page" unless index
      index.data["archive_months"] = months.keys.sort.reverse.map do |key|
        { "url" => "/archive/#{key}/", "label" => Date.strptime(key, "%Y/%m").strftime("%B %Y"), "count" => months[key].length }
      end
      months.each do |key, entries|
        page = Jekyll::PageWithoutAFile.new(site, site.source, "archive/#{key}", "index.html")
        label = Date.strptime(key, "%Y/%m").strftime("%B %Y")
        page.data.merge!({"layout"=>"news-archive-month", "title"=>"#{label} News Archive", "description"=>"Pakistan Report articles published in #{label}.", "archive_days"=>entries.group_by { |p| p.date.getlocal("+05:00").strftime("%Y-%m-%d") }.map { |day, articles| {"day"=>day, "articles"=>articles} }})
        site.pages << page
      end
    end
  end
end
