# Category pagination for Pakistan Report. Generates crawlable static pages.
module PakistanReport
  class CategoryPagination < Jekyll::Generator
    safe true
    priority :low

    PER_PAGE = 12

    def generate(site)
      category_pages = site.pages.select { |page| page.data["layout"] == "category" && page.data["category"] }
      category_pages.each do |page|
        posts = site.posts.docs.select { |post| post.data["category"] == page.data["category"] }
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
    end
  end
end
