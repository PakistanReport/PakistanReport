# frozen_string_literal: true
module PakistanReport
  class RelatedCoverage < Jekyll::Generator
    safe true
    priority :low
    TOPICS = {
      "fuel prices" => /petrol|diesel|fuel price|petroleum price/i,
      "fuel infrastructure" => /fuel storage|oil storage|oil terminal|fuel import|oil pipeline/i,
      "automobile policy" => /auto policy|automobile|vehicle export|auto parts|car manufacturing/i,
      "digital government" => /digital government|government services|digital public|digital authority|digital nation|e-government/i,
      "internet connectivity" => /submarine cable|broadband|satellite internet|internet licence|internet connectivity/i,
      "school safety" => /school safety|unsafe school|school building|school collapse/i,
      "kp development" => /(?:kp|khyber pakhtunkhwa|merged districts).{0,80}(?:development|irrigation|solar|infrastructure)|(?:development|irrigation|solar|infrastructure).{0,80}(?:kp|khyber pakhtunkhwa|merged districts)/i,
      "imf" => /\bimf\b|international monetary fund/i,
      "monetary policy" => /policy rate|interest rate|monetary policy/i,
      "inflation" => /inflation|consumer price index/i,
      "export finance" => /trade financing|export financ|trade finance/i,
      "aviation" => /\bpia\b|airline|aviation|airport/i,
      "ports" => /seaport|shipping|port terminal|karachi port|gwadar port/i,
      "air pollution" => /smog|air pollution|air quality/i,
      "taxation" => /tax revenue|tax collection|tax reform|sales tax|income tax/i,
      "electricity tariffs" => /electricity tariff|power tariff|electricity price|power purchase cost/i,
      "banking regulation" => /banking regulation|capital adequacy|bank equity|banking sector/i,
      "corporate acquisitions" => /acquisition|merger|stake purchase/i,
      "livestock" => /livestock|animal vaccine|foot.and.mouth/i,
      "ukraine diplomacy" => /ukraine.{0,60}(peace|talks|ceasefire)|(?:peace|talks|ceasefire).{0,60}ukraine/i
    }.freeze
    STOP = %w[pakistan pakistani government says said new report announces announced plans plan year years country federal national million billion rupees pakistan's will from with into over under after before about their have has for the and of to in on by as at is a an rs].freeze
    ACTIVE = %w[Pakistan Politics Economy Business World Technology].freeze
    def terms(text)
      text.downcase.scan(/[a-z][a-z-]{2,}/).reject { |w| STOP.include?(w) }.uniq
    end
    def generate(site)
      posts = site.posts.docs.select { |p| p.data["published"] != false }.sort_by { |p| [p.date, p.url] }.reverse
      pool = posts.select { |p| ACTIVE.include?(p.data["category"]) }
      titles = posts.to_h { |p| [p.url, terms(p.data["title"].to_s)] }
      subjects = posts.to_h do |p|
        headline = p.data["title"].to_s
        [p.url, TOPICS.select { |_, pattern| pattern.match?(headline) }.keys]
      end
      frequency = Hash.new(0)
      titles.each_value { |words| words.each { |w| frequency[w] += 1 } }
      posts.each do |p|
        more = posts.select { |q| q.url != p.url && q.data["category"] == p.data["category"] }.first(4)
        p.data["pr_more_from"] = more
        excluded = more.map(&:url) + [p.url]
        ranked = pool.filter_map do |q|
          next if excluded.include?(q.url)
          common = titles[p.url] & titles[q.url]
          shared = subjects[p.url] & subjects[q.url]
          rare = common.select { |w| frequency[w] <= 25 }
          next if shared.empty? && (rare.size < 2 || common.size < 3)
          next if !subjects[p.url].empty? && !subjects[q.url].empty? && shared.empty?
          score = shared.size * 5 + common.sum { |w| Math.log(1.0 + posts.size.to_f / frequency[w]) }
          [q, score]
        end
        p.data["pr_related_coverage"] = ranked.sort_by { |q, score| [-score, q.url] }.first(3).map(&:first)
      end
    end
  end
end
