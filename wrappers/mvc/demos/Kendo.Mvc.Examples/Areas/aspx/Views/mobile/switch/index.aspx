﻿<%@ Page Title="" Language="C#" MasterPageFile="~/Areas/aspx/Views/Shared/Mobile.Master" Inherits="System.Web.Mvc.ViewPage<dynamic>" %>

<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">

<% Html.Kendo().MobileView()
        .Name("switch-home")
        .Layout("examples")
        .Title("User Settings")
        .Content(() =>
        {
            %>
            <ul data-role="listview" data-style="inset" data-type="group">
                <li>Profile
                    <ul>
                        <li><h2>Eduardo <span>Saavedra</span></h2><img src="../../content/mobile/overview/eduardo.jpg" /></li>
                        <li>Brand Manager at Marketing Team</li>
                    </ul>
                </li>

                <li>Password
                    <ul>
                        <li>User cannot change pasword                         
                        <%= Html.Kendo().MobileSwitch()
                                .Name("email-switch")
                                .Checked(true)
                        %>
                        </li>
                        <li>Password never expires 
                        <%= Html.Kendo().MobileSwitch()
                                .Name("wink-switch")                                
                        %>
                        </li>
                    </ul>
                </li>

                <li>Newsletter Subscription
                    <ul>
                        <li>Subscribed
                        <%= Html.Kendo().MobileSwitch()
                                .Name("subscription-switch")
                                .Checked(true)
                                .OnLabel("YES")
                                .OffLabel("NO")
                        %>
                        </li>
                    </ul>
                </li>
            </ul>
            <%
        })
        .Render();
%>

<style scoped>
    #switch-home h2 {
        display: inline-block;
        font-size: 1.1em;
        margin: 1.5em 0 0 1em;
    }
    #switch-home h2 span {
        display: block;
        clear: both;
        font-size: 2em;
        margin: .2em 0 0 0;
    }
    #switch-home img {
        width: 5em;
        height: 5em;
        float: left;
        margin: 1em;
        -webkit-box-shadow: 0 1px 3px #333;
        box-shadow: 0 1px 3px #333;
        -webkit-border-radius: 8px;
        border-radius: 8px;
    }
</style>
</asp:Content>
