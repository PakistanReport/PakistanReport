# Category pagination for Pakistan Report. Generates crawlable static pages.
module PakistanReport
  class CategoryPagination < Jekyll::Generator
    safe true
    priority :low

    PER_PAGE = 12

    def generate(site)
      category_pages = site.pages.select { |page| page.data["layout"] == "category" && (page.data["category"] || page.data["categories"]) }
      category_pages.each do |page|
        categories = Array(page.data["categories"] || page.data["category"])
        posts = site.posts.docs.select { |post| categories.include?(post.data["category"]) }
        posts.sort_by!(&:date)
        posts.reverse!
        total_pages = [(posts.length.to_f / PER_PAGE).ceil, 1].max
        base_url = page.url.sub(%r{/index\.html$}, "/").sub(%r{/?$}, "/")

        total_pages.times do |index|
          current = index + 1
          target = if current == 1
                     page
                   else
                     dir = File.join(page.dir, "page", current.to_s)
                     generated = Jekyll::PageWithoutAFile.new(site, site.source, dir, "index.html")
                     generated.data.merge!(page.data)
                     generated.data.delete("permalink") # Each generated page needs its own URL.
                     site.pages << generated
                     generated
                   end
          target.data["category_page_posts"] = posts.slice(index * PER_PAGE, PER_PAGE) || []
          target.data["category_pagination"] = {
            "page" => current,
            "total_pages" => total_pages,
            "previous_url" => current > 1 ? (current == 2 ? base_url : "#{base_url}page/#{current - 1}/") : nil,
            "next_url" => current < total_pages ? "#{base_url}page/#{current + 1}/" : nil,
            "base_url" => base_url
          }
          target.data["title"] = "#{page.data['title']} — Page #{current}" if current > 1
        end
      end

      # The latest-stories archive uses the same static pagination as category pages.
      site.pages.select { |page| page.data["latest_archive"] == true }.each do |page|
        excluded = ["Iran Conflict", "Jobs", "Explainer"]
        posts = site.posts.docs.reject { |post| excluded.include?(post.data["category"]) }
        posts.sort_by!(&:date)
        posts.reverse!
        total_pages = [(posts.length.to_f / PER_PAGE).ceil, 1].max
        base_url = "/latest/"

        total_pages.times do |index|
          current = index + 1
          target = if current == 1
                     page
                   else
                     generated = Jekyll::PageWithoutAFile.new(site, site.source, File.join("latest", "page", current.to_s), "index.html")
                     generated.data.merge!(page.data)
                     generated.data.delete("permalink")
                     site.pages << generated
                     generated
                   end
          target.data["latest_page_posts"] = posts.slice(index * PER_PAGE, PER_PAGE) || []
          target.data["latest_pagination"] = {
            "page" => current,
            "total_pages" => total_pages,
            "previous_url" => current > 1 ? (current == 2 ? base_url : "#{base_url}page/#{current - 1}/") : nil,
            "next_url" => current < total_pages ? "#{base_url}page/#{current + 1}/" : nil,
            "base_url" => base_url
          }
          target.data["title"] = "Latest Stories — Page #{current}" if current > 1
        end
      end
    end
  end
end
