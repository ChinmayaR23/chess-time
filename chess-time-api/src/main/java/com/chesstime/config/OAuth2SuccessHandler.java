package com.chesstime.config;

import com.chesstime.model.User;
import com.chesstime.service.JwtService;
import com.chesstime.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final UserService userService;
    private final JwtService jwtService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User oAuth2User = oauthToken.getPrincipal();
        String provider = oauthToken.getAuthorizedClientRegistrationId(); // "github" or "google"

        User user = userService.findOrCreateFromOAuth(oAuth2User, provider);
        String jwt = jwtService.generateToken(user.getId(), user.getEmail(), user.getRating());

        String redirectUrl = frontendUrl + "/auth/callback?token=" +
                URLEncoder.encode(jwt, StandardCharsets.UTF_8) +
                "&name=" + URLEncoder.encode(user.getName() != null ? user.getName() : "", StandardCharsets.UTF_8) +
                "&rating=" + user.getRating();

        log.info("OAuth2 login success for user: {}", user.getEmail());
        response.sendRedirect(redirectUrl);
    }
}
