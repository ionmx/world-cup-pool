require 'rubygems'
require 'pp'
require "net/http"
require 'json'
require 'firebase'

#########
# Utils
#########

def getWinner(home, visitor)
  if home > visitor
    winner = 'home'
  elsif home < visitor
    winner = 'visitor'
  else
    winner = 'tied'
  end
end

def getScore(home, visitor, homePrediction, visitorPrediction)
  points = 0

  if home >= 0 && !homePrediction.nil? && !visitorPrediction.nil?
    if home == homePrediction && visitor == visitorPrediction
      points = 15;
    elsif getWinner(home, visitor) == getWinner(homePrediction, visitorPrediction)
      points = 10 - (homePrediction - home).abs - (visitorPrediction - visitor).abs
      if points < 0
        points = 0
      end
    else
      points = 0
    end
  end

  if points.nil?
    points = 0
  end

  points

end

#-------
# Main
#-------

firebase_uri = "https://fifapool2014.firebaseio.com"

agent = "Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5"
server = "msn.foxsports.com"
path = "/foxbox/Soccer/API/League/Schedule?competition=12"

#------------------------------------
puts " Get scores from Fox Sports..."
#------------------------------------
http = Net::HTTP.new(server, 80)
req = Net::HTTP::Get.new(path, {'User-Agent' => agent})
response = http.request(req)
json = JSON.parse(response.body)

#data = File.read('data.json')
#json = JSON.parse(data)

firebase = Firebase::Client.new(firebase_uri)

today = Date.today.strftime('%Y%m%d');

matches = {}
matchesFB = firebase.get('matches')

#------------------------------
puts " Create matches array..."
#------------------------------
matchesFB.body.each_with_index do |m, index|
  if !m.nil?
    key = "#{m['home']}_#{m['visitor']}"
    json['Events'].each do |e|
      if !e['HomeAbbrev'].nil? && !e['AwayAbbrev'].nil?
        e_key = "#{e['HomeAbbrev'].downcase}_#{e['AwayAbbrev'].downcase}"
        if key == e_key
          m['homeReal'] = e['HomeScore']
          m['visitorReal'] = e['AwayScore']
        end
      end
    end
    matches[index] = m
  end
end

#--------------------------
puts " Update matches..."
#--------------------------
matches.each do |k, m|
  if !m['homeReal'].nil? &&
     !m['visitorReal'].nil? &&
     (m['homeReal'].to_i != m['homeGoals'].to_i ||
      m['visitorReal'].to_i != m['visitorGoals'].to_i)

   puts " Update #{m['home']} vs. #{m['visitor']} from #{m['homeGoals']}-#{m['visitorGoals']} to #{m['homeReal']}-#{m['visitorReal']}"

   data = { :homeGoals => m['homeReal'], :visitorGoals => m['visitorReal'] }

   response = firebase.update("matches/#{k}", data)
   if response.success?
     puts "OK"
   else
     puts "FAIL"
   end


  end
end

#-------------------------
puts " Get user scores..."
#-------------------------
users = firebase.get('users')
user_scores = {}
users.body.each do |key,val|
  user_scores[key] = val['score']
end

#--------------------------------
puts " Calculate users scores..."
#--------------------------------
scores = {}
predictions = firebase.get('predictions')

predictions.body.each do |key,val|
  aux = key.split('_')
  match_id = aux.pop.to_i
  user_id = aux.join('_')

  # Calculate if match has goals
  if !matches[match_id]['homeReal'].nil?
    s = getScore(matches[match_id]['homeReal'], matches[match_id]['visitorReal'], val['homePrediction'], val['visitorPrediction'])
    if scores[user_id].nil?
      scores[user_id] = s
    else
      scores[user_id] += s
    end
  end

end

#---------------------
puts " Update users..."
#---------------------
scores.each do |user,score|
  if user_scores[user] != score
    puts " Update '#{user}' score to #{score}"
    response = firebase.update("users/#{user}", {:score => score})
    if response.success?
      puts "OK"
    else
      puts "FAIL"
    end
  else
    puts " User #{user} score up to date"
  end
end
