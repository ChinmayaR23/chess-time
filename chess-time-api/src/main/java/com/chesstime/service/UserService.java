package com.chesstime.service;

import com.chesstime.model.User;
import com.chesstime.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public User findOrCreateFromOAuth(OAuth2User oAuth2User, String provider) {
        String providerId = oAuth2User.getAttribute("id") != null
                ? String.valueOf(oAuth2User.getAttribute("id"))
                : oAuth2User.getAttribute("sub");

        return userRepository.findByProviderAndProviderId(provider, providerId)
                .orElseGet(() -> {
                    User user = new User();
                    user.setProvider(provider);
                    user.setProviderId(providerId);
                    user.setName(oAuth2User.getAttribute("name"));
                    user.setEmail(oAuth2User.getAttribute("email"));
                    user.setImage(oAuth2User.getAttribute("avatar_url") != null
                            ? oAuth2User.getAttribute("avatar_url")
                            : oAuth2User.getAttribute("picture"));
                    return userRepository.save(user);
                });
    }

    public User findById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
    }

    @Transactional
    public void updateRating(String userId, int newRating, String result) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setRating(newRating);
            user.setGamesPlayed(user.getGamesPlayed() + 1);
            switch (result) {
                case "win" -> user.setGamesWon(user.getGamesWon() + 1);
                case "loss" -> user.setGamesLost(user.getGamesLost() + 1);
                case "draw" -> user.setGamesDrawn(user.getGamesDrawn() + 1);
            }
            userRepository.save(user);
        });
    }
}
