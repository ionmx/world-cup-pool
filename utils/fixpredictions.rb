require 'rubygems'
require 'pp'
require 'firebase'
require 'json'

configFile = File.read(File.expand_path("../../config.json", __FILE__))
config = JSON.load(configFile)

firebase_uri = config['firebase']
firebase = Firebase::Client.new(firebase_uri)

users = firebase.get('users')
matches = firebase.get('matches')

users.body.each do |uk, uv|
  puts "------------------"
  puts "USER: #{uk}"
  puts "PREDICTIONS:"
  preds = firebase.get("users/#{uk}/predictions")
  if preds.body
    preds_array = preds.body.map { |pk,pv| pk }
    matches.body.each_with_index do |m, mindex|
      pred_key = "#{uk}_#{mindex}"
      if preds_array.include? pred_key
        puts "#{pred_key} OK"
      else
        if mindex != 0
          puts "#{pred_key} needs to be created"

          response = firebase.set("users/#{uk}/predictions/#{pred_key}", true)
          if response.success?
            puts "Relationship created"
          else
            puts "Can't create relationship"
          end

          data = {:date => Time.now.to_i * 1000, :user => "#{uk}" }
          response = firebase.set("predictions/#{pred_key}", data)
          if response.success?
            puts "Prediction created"
          else
            puts "Can't create prediction"
          end

        end
      end
    end
  else
    puts "FAIL"
  end
end
